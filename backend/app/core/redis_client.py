import logging

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis: Redis | None = None


async def init_redis() -> None:
    global _redis
    settings = get_settings()
    client = Redis.from_url(settings.redis_url, decode_responses=True)
    await client.ping()
    _redis = client
    logger.info("Redis connected: %s", settings.redis_url.split("@")[-1])


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> Redis:
    if _redis is None:
        raise RuntimeError("Redis is not initialized")
    return _redis


async def redis_ping() -> bool:
    if _redis is None:
        return False
    try:
        await _redis.ping()
        return True
    except Exception:
        logger.exception("Redis ping failed")
        return False
