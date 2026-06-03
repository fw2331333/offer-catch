import logging

from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _fail_key_email(email: str) -> str:
    return f"rl:login:fail:email:{email}"


def _fail_key_ip(ip: str) -> str:
    return f"rl:login:fail:ip:{ip}"


def _forgot_key(email: str) -> str:
    return f"rl:forgot:email:{email}"


async def _incr_with_ttl(redis: Redis, key: str, window_sec: int) -> int:
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_sec)
    return int(count)


async def check_login_allowed(redis: Redis, email: str, ip: str) -> None:
    settings = get_settings()
    max_email = settings.login_rate_limit_max_attempts
    max_ip = settings.login_rate_limit_max_ip_attempts
    window = settings.login_rate_limit_window_seconds

    email_count = await redis.get(_fail_key_email(email))
    if email_count and int(email_count) >= max_email:
        ttl = await redis.ttl(_fail_key_email(email))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"该邮箱登录失败次数过多，请 {max(ttl, 1)} 秒后再试",
        )

    ip_count = await redis.get(_fail_key_ip(ip))
    if ip_count and int(ip_count) >= max_ip:
        ttl = await redis.ttl(_fail_key_ip(ip))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"登录尝试过于频繁，请 {max(ttl, 1)} 秒后再试",
        )


async def record_login_failure(redis: Redis, email: str, ip: str) -> None:
    settings = get_settings()
    window = settings.login_rate_limit_window_seconds
    email_n = await _incr_with_ttl(redis, _fail_key_email(email), window)
    ip_n = await _incr_with_ttl(redis, _fail_key_ip(ip), window)
    logger.info("Login failure recorded email=%s (%s) ip=%s (%s)", email, email_n, ip, ip_n)


async def clear_login_failures(redis: Redis, email: str, ip: str) -> None:
    await redis.delete(_fail_key_email(email), _fail_key_ip(ip))


async def check_forgot_password_allowed(redis: Redis, email: str) -> None:
    settings = get_settings()
    key = _forgot_key(email)
    count = await redis.get(key)
    if count and int(count) >= settings.forgot_password_rate_limit_max:
        ttl = await redis.ttl(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"重置密码邮件发送过于频繁，请 {max(ttl, 1)} 秒后再试",
        )


async def record_forgot_password(redis: Redis, email: str) -> None:
    settings = get_settings()
    await _incr_with_ttl(redis, _forgot_key(email), settings.forgot_password_rate_limit_window_seconds)
