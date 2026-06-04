"""
岗位 CRUD、解析 JD、AI 搜岗等。

需要登录：Depends(get_current_user)。列表接口演示 Redis 缓存模式。
"""
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.redis_client import get_redis
from app.db.session import get_db
from app.models.job import JobPosting
from app.models.user import StudentProfile, User
from app.schemas.job import (
    AiDiscoveredJob,
    AiImportRequest,
    AiImportResponse,
    AiSearchRequest,
    AiSearchResponse,
    JobCreate,
    JobDetail,
    JobListItem,
    JobResumeAnalysisResponse,
    JobShareUpdate,
    JobUpdate,
    LocalSearchHit,
    ParseJobResponse,
    ParsedJobPreview,
    ParseTextRequest,
)
from app.services.job_parser import extract_text_from_image, parse_jd_text, parse_job_file
from app.services.job_search import (
    discover_jobs_with_ai,
    job_from_create_data,
    search_local_jobs,
)
from app.services.matching import get_active_resume, score_job_match
from app.services.optimization import optimize_resume_for_job
from app.llm.errors import LLMServiceError
from app.services.user_keys import require_api_key
from app.services.redis_cache import (
    cache_get_json,
    cache_set_json,
    invalidate_jobs_cache,
    job_detail_cache_key,
    job_detail_ttl,
    jobs_list_cache_key,
    jobs_list_ttl,
)
from app.services.job_visibility import assert_job_visible, job_visible_clause, job_visible_to_user
from app.services.resume_parser import ensure_upload_dir

router = APIRouter(prefix="/jobs", tags=["岗位"])


def _job_to_list_item(
    job: JobPosting,
    user_id: int,
    usernames: dict[int, str],
) -> JobListItem:
    owner_id = job.created_by_user_id
    is_mine = owner_id == user_id
    is_seed = (getattr(job, "source", None) or "seed") == "seed"
    shared_by = None
    if not is_mine and not is_seed and job.is_shared and owner_id:
        shared_by = usernames.get(owner_id) or "其他用户"
    return JobListItem(
        id=job.id,
        company=job.company,
        title=job.title,
        city=job.city,
        job_type=job.job_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        industry=job.industry,
        tags=job.tags or [],
        source=getattr(job, "source", None) or "seed",
        source_url=getattr(job, "source_url", None),
        is_mine=is_mine,
        is_shared=bool(job.is_shared),
        shared_by_username=shared_by,
    )


async def _load_usernames(db: AsyncSession, jobs: list[JobPosting]) -> dict[int, str]:
    owner_ids = {j.created_by_user_id for j in jobs if j.created_by_user_id is not None}
    if not owner_ids:
        return {}
    result = await db.execute(select(User.id, User.username).where(User.id.in_(owner_ids)))
    return {row[0]: row[1] for row in result.all()}


async def _jobs_to_list_items(db: AsyncSession, jobs: list[JobPosting], user_id: int) -> list[JobListItem]:
    names = await _load_usernames(db, jobs)
    return [_job_to_list_item(j, user_id, names) for j in jobs]


def _to_job_detail(job: JobPosting, user_id: int, usernames: dict[int, str]) -> JobDetail:
    base = _job_to_list_item(job, user_id, usernames)
    is_mine = job.created_by_user_id == user_id
    can_manage = is_mine and job.source != "seed"
    return JobDetail(
        **base.model_dump(),
        description=job.description or "",
        requirements=job.requirements,
        created_by_user_id=getattr(job, "created_by_user_id", None),
        created_at=job.created_at,
        can_edit=can_manage,
        can_share=can_manage,
    )


@router.get("", response_model=list[JobListItem])
async def list_jobs(
    city: str | None = None,
    job_type: str | None = None,
    source: str | None = None,
    q: str | None = Query(None, description="关键词"),
    limit: int = Query(50, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    redis = get_redis()
    cache_key = jobs_list_cache_key(user.id, city, job_type, source, q, limit)
    cached = await cache_get_json(redis, cache_key)
    if cached is not None:
        return [JobListItem.model_validate(item) for item in cached]

    stmt = select(JobPosting).where(job_visible_clause(user.id))
    if city:
        stmt = stmt.where(JobPosting.city == city)
    if job_type:
        stmt = stmt.where(JobPosting.job_type == job_type)
    if source:
        stmt = stmt.where(JobPosting.source == source)
    if q:
        stmt = stmt.where(JobPosting.title.ilike(f"%{q}%") | JobPosting.company.ilike(f"%{q}%"))
    stmt = stmt.order_by(JobPosting.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    jobs = list(result.scalars().all())
    items = await _jobs_to_list_items(db, jobs, user.id)
    await cache_set_json(
        redis,
        cache_key,
        [item.model_dump(mode="json") for item in items],
        jobs_list_ttl(),
    )
    return items


@router.post("", response_model=JobDetail, status_code=201)
async def create_job(
    body: JobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = job_from_create_data(body.model_dump(), source="manual", user_id=user.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await invalidate_jobs_cache(get_redis(), job.id)
    names = await _load_usernames(db, [job])
    return _to_job_detail(job, user.id, names)


async def _save_parsed(
    db: AsyncSession,
    user: User,
    data: dict,
    source: str,
) -> JobPosting:
    job = job_from_create_data(data, source=source, user_id=user.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await invalidate_jobs_cache(get_redis(), job.id)
    return job


def _to_preview(data: dict) -> ParsedJobPreview:
    return ParsedJobPreview(
        company=data["company"],
        title=data["title"],
        city=data.get("city") or "未知",
        job_type=data.get("job_type") or "实习",
        salary_min=data.get("salary_min"),
        salary_max=data.get("salary_max"),
        industry=data.get("industry"),
        description=data.get("description") or "",
        requirements=data.get("requirements"),
        tags=data.get("tags") or [],
        parse_note=str(data.get("parse_note") or ""),
    )


@router.post("/parse-text", response_model=ParseJobResponse)
async def parse_text_job(
    body: ParseTextRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        api_key = require_api_key(user)
        parsed = await parse_jd_text(body.content, api_key=api_key)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e

    job_detail = None
    if body.save:
        job = await _save_parsed(db, user, parsed, source="paste")
        names = await _load_usernames(db, [job])
        job_detail = _to_job_detail(job, user.id, names)

    return ParseJobResponse(
        source_type="paste",
        extracted_text=body.content[:5000],
        parsed=_to_preview(parsed),
        job=job_detail,
    )


@router.post("/parse-file", response_model=ParseJobResponse)
async def parse_file_job(
    file: UploadFile = File(...),
    save: bool = Query(False, description="为 true 时直接保存到岗位库"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    suffix = Path(file.filename or "job.pdf").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(400, detail="仅支持 pdf、docx、txt 文件")

    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, detail=f"文件不能超过 {settings.max_upload_mb}MB")

    ensure_upload_dir(settings.upload_dir)
    safe = f"jobdocs/{user.id}_{uuid.uuid4().hex}{suffix}"
    dest = Path(settings.upload_dir) / safe
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    try:
        api_key = require_api_key(user)
        raw_text, parsed = await parse_job_file(str(dest), api_key=api_key)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(400, detail=f"解析失败: {e}") from e

    job_detail = None
    if save:
        job = await _save_parsed(db, user, parsed, source="file")
        names = await _load_usernames(db, [job])
        job_detail = _to_job_detail(job, user.id, names)

    return ParseJobResponse(
        source_type="file",
        extracted_text=raw_text[:5000],
        parsed=_to_preview(parsed),
        job=job_detail,
    )


@router.post("/parse-screenshot", response_model=ParseJobResponse)
async def parse_screenshot_job(
    file: UploadFile = File(...),
    save: bool = Query(True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    suffix = Path(file.filename or "shot.png").suffix.lower()
    if suffix not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        raise HTTPException(400, detail="仅支持 png、jpg、jpeg、webp、bmp 截图")

    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, detail=f"图片不能超过 {settings.max_upload_mb}MB")

    try:
        api_key = require_api_key(user)
        raw_text = extract_text_from_image(content)
        parsed = await parse_jd_text(raw_text, api_key=api_key)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e

    ensure_upload_dir(settings.upload_dir)
    safe = f"jobshots/{user.id}_{uuid.uuid4().hex}{suffix}"
    dest = Path(settings.upload_dir) / safe
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    job_detail = None
    if save:
        job = await _save_parsed(db, user, parsed, source="screenshot")
        names = await _load_usernames(db, [job])
        job_detail = _to_job_detail(job, user.id, names)

    return ParseJobResponse(
        source_type="screenshot",
        extracted_text=raw_text[:5000],
        parsed=_to_preview(parsed),
        job=job_detail,
    )


@router.post("/{job_id}/resume-analysis", response_model=JobResumeAnalysisResponse)
async def analyze_job_with_resume(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = assert_job_visible(await db.get(JobPosting, job_id), user.id)

    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    resume = await get_active_resume(db, user.id)

    if not resume:
        raise HTTPException(
            400,
            detail="请先在对话页上传简历，再进行匹配分析",
        )

    try:
        api_key = require_api_key(user)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    match = await score_job_match(job, resume, profile, api_key=api_key, use_llm=True)
    opt = await optimize_resume_for_job(db, resume, job, api_key=api_key)

    return JobResumeAnalysisResponse(
        job_id=job.id,
        job_title=job.title,
        company=job.company,
        has_resume=True,
        overall_score=float(match.get("overall_score", 0)),
        recommendation=str(match.get("recommendation", "try")),
        match_summary=str(match.get("summary") or match.get("explanation") or ""),
        matched_items=match.get("matched_items") or [],
        gaps=match.get("gaps") or [],
        risks=match.get("risks") or [],
        optimization_summary=str(opt.get("summary") or ""),
        suggestions=opt.get("suggestions") or [],
    )


@router.post("/ai-search", response_model=AiSearchResponse)
async def ai_search_jobs(
    body: AiSearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    try:
        try:
            api_key = require_api_key(user)
        except ValueError as e:
            raise HTTPException(400, detail=str(e)) from e
        local = await search_local_jobs(
            db,
            body.query,
            api_key=api_key,
            user_id=user.id,
            limit=15,
            profile=profile,
            city=body.city,
            job_type=body.job_type,
            roles=body.roles,
        )
        job_rows = [j for j, _ in local]
        names = await _load_usernames(db, job_rows)
        local_hits = [
            LocalSearchHit(
                **_job_to_list_item(job, user.id, names).model_dump(),
                match_reason=reason,
            )
            for job, reason in local
        ]

        ai_jobs: list[AiDiscoveredJob] = []
        summary = f"已在岗位库中找到 {len(local_hits)} 条相关记录。"
        if body.include_ai_discovery:
            ai_summary, raw_jobs = await discover_jobs_with_ai(
                body.query,
                profile,
                api_key=api_key,
                limit=body.limit,
                city=body.city,
                job_type=body.job_type,
                roles=body.roles,
            )
            if ai_summary:
                summary = ai_summary
            for item in raw_jobs:
                if not isinstance(item, dict) or not item.get("company") or not item.get("title"):
                    continue
                try:
                    ai_jobs.append(AiDiscoveredJob(**item))
                except Exception:
                    continue

        return AiSearchResponse(
            query=body.query,
            search_summary=summary,
            local_jobs=local_hits,
            ai_discovered=ai_jobs,
        )
    except LLMServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(500, detail=f"AI 查找失败：{e}") from e


@router.post("/ai-import", response_model=AiImportResponse)
async def import_ai_jobs(
    body: AiImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.jobs:
        raise HTTPException(400, detail="请选择要导入的岗位")
    imported: list[JobPosting] = []
    for item in body.jobs:
        job = job_from_create_data(item.model_dump(), source="ai", user_id=user.id)
        db.add(job)
        imported.append(job)
    await db.commit()
    for job in imported:
        await db.refresh(job)
    await invalidate_jobs_cache(get_redis())
    imported_items = await _jobs_to_list_items(db, imported, user.id)
    return AiImportResponse(imported=imported_items, count=len(imported))


@router.patch("/{job_id}/share", response_model=JobListItem)
async def set_job_share(
    job_id: int,
    body: JobShareUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, detail="岗位不存在")
    if job.source == "seed":
        raise HTTPException(403, detail="系统预置岗位不可共享")
    if job.created_by_user_id != user.id:
        raise HTTPException(403, detail="仅可共享自己录入的岗位")
    job.is_shared = body.shared
    await db.commit()
    await db.refresh(job)
    await invalidate_jobs_cache(get_redis(), job.id)
    names = await _load_usernames(db, [job])
    return _job_to_list_item(job, user.id, names)


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    redis = get_redis()
    cache_key = job_detail_cache_key(job_id, user.id)
    cached = await cache_get_json(redis, cache_key)
    if cached is not None:
        return JobDetail.model_validate(cached)

    job = assert_job_visible(await db.get(JobPosting, job_id), user.id)
    names = await _load_usernames(db, [job])
    detail = _to_job_detail(job, user.id, names)
    await cache_set_json(redis, cache_key, detail.model_dump(mode="json"), job_detail_ttl())
    return detail


@router.put("/{job_id}", response_model=JobDetail)
async def update_job(
    job_id: int,
    body: JobUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, detail="岗位不存在")
    if job.source == "seed":
        raise HTTPException(403, detail="系统预置岗位不可编辑")
    if job.created_by_user_id is not None and job.created_by_user_id != user.id:
        raise HTTPException(403, detail="无权编辑此岗位")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "requirements" and value is not None:
            if hasattr(value, "model_dump"):
                value = value.model_dump()
        setattr(job, field, value)
    await db.commit()
    await db.refresh(job)
    await invalidate_jobs_cache(get_redis(), job.id)
    names = await _load_usernames(db, [job])
    return _to_job_detail(job, user.id, names)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, detail="岗位不存在")
    if job.source == "seed":
        raise HTTPException(403, detail="系统预置岗位不可删除")
    if job.created_by_user_id is not None and job.created_by_user_id != user.id:
        raise HTTPException(403, detail="无权删除此岗位")
    await db.delete(job)
    await db.commit()
    await invalidate_jobs_cache(get_redis(), job_id)
