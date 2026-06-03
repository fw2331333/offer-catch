"""
读多写少的接口用 Redis 缓存 JSON，减轻 PostgreSQL 压力。

模式：先 cache_get_json → 未命中查库 → cache_set_json；写操作后 invalidate_* 删相关键。
"""
import hashlib
import json
import logging
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PREFIX_JOBS_LIST = "cache:jobs:list:"
PREFIX_JOB_DETAIL = "cache:job:detail:"
PREFIX_PROFILE = "cache:profile:"


def jobs_list_cache_key(
    city: str | None,
    job_type: str | None,
    source: str | None,
    q: str | None,
    limit: int,
) -> str:
    raw = "|".join(
        [
            city or "",
            job_type or "",
            source or "",
            q or "",
            str(limit),
        ]
    )
    digest = hashlib.sha256(raw.encode()).hexdigest()[:20]  # 查询参数拼成短键，避免键过长
    return f"{PREFIX_JOBS_LIST}{digest}"


def job_detail_cache_key(job_id: int) -> str:
    return f"{PREFIX_JOB_DETAIL}{job_id}"


def profile_cache_key(user_id: int) -> str:
    return f"{PREFIX_PROFILE}{user_id}"


async def cache_get_json(redis: Redis, key: str) -> Any | None:
    try:
        raw = await redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.exception("Redis cache get failed: %s", key)
        return None


async def cache_set_json(redis: Redis, key: str, value: Any, ttl_sec: int) -> None:
    try:
        await redis.set(key, json.dumps(value, default=str), ex=ttl_sec)
    except Exception:
        logger.exception("Redis cache set failed: %s", key)


async def cache_delete_prefix(redis: Redis, prefix: str) -> int:
    deleted = 0
    try:
        async for key in redis.scan_iter(match=f"{prefix}*"):
            await redis.delete(key)
            deleted += 1
    except Exception:
        logger.exception("Redis cache delete prefix failed: %s", prefix)
    return deleted


async def invalidate_jobs_cache(redis: Redis, job_id: int | None = None) -> None:
    await cache_delete_prefix(redis, PREFIX_JOBS_LIST)
    if job_id is not None:
        await redis.delete(job_detail_cache_key(job_id))


async def invalidate_profile_cache(redis: Redis, user_id: int) -> None:
    await redis.delete(profile_cache_key(user_id))


def jobs_list_ttl() -> int:
    return get_settings().cache_ttl_jobs_list


def job_detail_ttl() -> int:
    return get_settings().cache_ttl_job_detail


def profile_ttl() -> int:
    return get_settings().cache_ttl_profile
