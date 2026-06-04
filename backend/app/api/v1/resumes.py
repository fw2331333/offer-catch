import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import OptimizeRequest, OptimizeResponse, ResumeListResponse, ResumeResponse
from app.services.resume_summary import resume_preview
from app.models.job import JobPosting
from app.services.matching import get_active_resume
from app.services.optimization import optimize_resume_for_job
from app.services.resume_parser import ensure_upload_dir, parse_resume_file
from app.services.user_keys import require_api_key

router = APIRouter(prefix="/resumes", tags=["简历"])


def _to_response(resume: Resume) -> ResumeResponse:
    return ResumeResponse(
        id=resume.id,
        filename=resume.filename,
        version=resume.version,
        is_active=resume.is_active,
        structured=resume.structured,
        created_at=resume.created_at,
        preview=resume_preview(resume.structured),
    )


@router.get("", response_model=ResumeListResponse)
async def list_resumes(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())
    )
    items = [_to_response(r) for r in result.scalars().all()]
    active_id = next((r.id for r in items if r.is_active), items[0].id if items else None)
    return ResumeListResponse(items=items, active_id=active_id)


@router.get("/latest", response_model=ResumeResponse | None)
async def latest_resume(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    resume = await get_active_resume(db, user.id)
    return _to_response(resume) if resume else None


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resume = await db.get(Resume, resume_id)
    if not resume or resume.user_id != user.id:
        raise HTTPException(404, detail="简历不存在")
    was_active = resume.is_active
    path = Path(resume.file_path)
    await db.delete(resume)
    await db.commit()
    if path.is_file():
        try:
            os.remove(path)
        except OSError:
            pass
    if was_active:
        result = await db.execute(
            select(Resume)
            .where(Resume.user_id == user.id)
            .order_by(Resume.created_at.desc())
            .limit(1)
        )
        next_resume = result.scalar_one_or_none()
        if next_resume:
            next_resume.is_active = True
            await db.commit()


@router.patch("/{resume_id}/activate", response_model=ResumeResponse)
async def activate_resume(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resume = await db.get(Resume, resume_id)
    if not resume or resume.user_id != user.id:
        raise HTTPException(404, detail="简历不存在")
    await db.execute(update(Resume).where(Resume.user_id == user.id).values(is_active=False))
    resume.is_active = True
    await db.commit()
    await db.refresh(resume)
    return _to_response(resume)


@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    ensure_upload_dir(settings.upload_dir)
    suffix = Path(file.filename or "resume.pdf").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(400, detail="仅支持 pdf、docx、txt")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, detail=f"文件不能超过 {settings.max_upload_mb}MB")

    safe_name = f"{user.id}_{uuid.uuid4().hex}{suffix}"
    dest = Path(settings.upload_dir) / safe_name
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    try:
        api_key = require_api_key(user)
        raw_text, structured = await parse_resume_file(str(dest), api_key=api_key)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(400, detail=f"解析失败: {e}") from e

    await db.execute(update(Resume).where(Resume.user_id == user.id).values(is_active=False))
    result = await db.execute(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.version.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    version = (last.version + 1) if last else 1

    resume = Resume(
        user_id=user.id,
        filename=file.filename or safe_name,
        file_path=str(dest),
        raw_text=raw_text,
        structured=structured,
        version=version,
        is_active=True,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return _to_response(resume)


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(
    body: OptimizeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resume = await get_active_resume(db, user.id)
    if not resume:
        raise HTTPException(400, detail="请先上传简历")
    job = await db.get(JobPosting, body.job_id)
    if not job:
        raise HTTPException(404, detail="岗位不存在")
    try:
        api_key = require_api_key(user)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    data = await optimize_resume_for_job(db, resume, job, api_key=api_key)
    return OptimizeResponse(
        job_id=job.id,
        job_title=job.title,
        company=job.company,
        before_score=float(data.get("before_score", 0)),
        suggestions=data.get("suggestions") or [],
        rewritten_sections=data.get("rewritten_sections") or [],
        summary=data.get("summary") or "",
    )
