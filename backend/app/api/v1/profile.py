from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.redis_client import get_redis
from app.db.session import get_db
from app.models.user import StudentProfile, User
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.redis_cache import (
    cache_get_json,
    cache_set_json,
    invalidate_profile_cache,
    profile_cache_key,
    profile_ttl,
)

router = APIRouter(prefix="/profile", tags=["求职画像"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    redis = get_redis()
    cache_key = profile_cache_key(user.id)
    cached = await cache_get_json(redis, cache_key)
    if cached is not None:
        return ProfileResponse.model_validate(cached)

    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = StudentProfile(user_id=user.id, target_cities=[], target_roles=[], industries=[])
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    response = ProfileResponse(
        user_id=user.id,
        target_cities=profile.target_cities or [],
        target_roles=profile.target_roles or [],
        industries=profile.industries or [],
        salary_min=profile.salary_min,
        salary_max=profile.salary_max,
        job_type=profile.job_type or "实习",
        bio=profile.bio,
    )
    await cache_set_json(redis, cache_key, response.model_dump(mode="json"), profile_ttl())
    return response


@router.put("", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
    profile.target_cities = body.target_cities
    profile.target_roles = body.target_roles
    profile.industries = body.industries
    profile.salary_min = body.salary_min
    profile.salary_max = body.salary_max
    profile.job_type = body.job_type
    profile.bio = body.bio
    await db.commit()
    await db.refresh(profile)
    await invalidate_profile_cache(get_redis(), user.id)
    return ProfileResponse(user_id=user.id, **body.model_dump())
