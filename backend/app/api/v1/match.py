from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.llm.errors import LLMServiceError
from app.models.user import StudentProfile, User
from app.schemas.match import (
    AnalyzeBatchRequest,
    MatchListItem,
    MatchReportResponse,
    RecommendRequest,
    RecommendResponse,
)
from app.services.matching import (
    BATCH_SIZE,
    analyze_jobs_stream,
    fetch_job_report,
    get_active_resume,
    init_recommend_queue,
    load_recommend_list,
    rank_jobs_for_recommend,
)
from app.services.user_keys import require_api_key

router = APIRouter(prefix="/match", tags=["岗位库匹配"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    body: RecommendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """规则排序生成推荐列表，全部标记为待分析；不调用 AI。"""
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    resume = await get_active_resume(db, user.id)

    ranked = await rank_jobs_for_recommend(
        db,
        profile,
        user_id=user.id,
        city=body.city,
        job_type=body.job_type,
        limit=body.limit,
    )
    items_raw = await init_recommend_queue(db, user.id, ranked)
    items = [MatchListItem.model_validate(x) for x in items_raw]

    profile_ok = bool(profile and (profile.target_cities or profile.target_roles))
    return RecommendResponse(
        items=items,
        resume_uploaded=resume is not None,
        profile_complete=profile_ok,
        batch_size=BATCH_SIZE,
    )


@router.get("/list", response_model=RecommendResponse)
async def list_match_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 30,
):
    """刷新左侧列表状态（分析进度与分数）。"""
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    resume = await get_active_resume(db, user.id)
    ranked = await rank_jobs_for_recommend(db, profile, user_id=user.id, limit=limit)
    items_raw = await load_recommend_list(db, user.id, ranked)
    items = [MatchListItem.model_validate(x) for x in items_raw]
    profile_ok = bool(profile and (profile.target_cities or profile.target_roles))
    return RecommendResponse(
        items=items,
        resume_uploaded=resume is not None,
        profile_complete=profile_ok,
        batch_size=BATCH_SIZE,
    )


@router.post("/analyze-batch")
async def analyze_batch(
    body: AnalyzeBatchRequest,
    user: User = Depends(get_current_user),
):
    try:
        api_key = require_api_key(user)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e

    return StreamingResponse(
        analyze_jobs_stream(user.id, body.job_ids, api_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/jobs/{job_id}/report", response_model=MatchReportResponse)
async def job_report(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        api_key = require_api_key(user)
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e

    try:
        data, _from_cache = await fetch_job_report(db, user.id, job_id, api_key)
    except LLMServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e

    return MatchReportResponse(**data)
