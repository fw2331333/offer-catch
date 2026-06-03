import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.email_verification import (
    PURPOSE_RESET_PASSWORD,
    PURPOSE_VERIFY_EMAIL,
    EmailVerificationToken,
)
from app.models.user import User
from app.services.email_sender import send_set_password_email

logger = logging.getLogger(__name__)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def build_set_password_url(raw_token: str) -> str:
    settings = get_settings()
    base = settings.app_public_url.rstrip("/")
    return f"{base}/set-password?{urlencode({'token': raw_token})}"


def should_expose_dev_link(email_sent: bool) -> bool:
    settings = get_settings()
    return settings.expose_dev_verify_link and not email_sent


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[0] + "*"
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


async def issue_email_token(
    db: AsyncSession,
    user: User,
    purpose: str,
) -> tuple[str, str, bool]:
    """创建令牌并发送邮件。返回 (raw_token, action_url, sent)。"""
    settings = get_settings()
    raw = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw)
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.email_verify_expire_hours)

    await db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.purpose == purpose,
        )
    )
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            purpose=purpose,
            expires_at=expires,
        )
    )
    await db.flush()

    action_url = build_set_password_url(raw)
    try:
        sent = await send_set_password_email(user.email, action_url, purpose)
    except Exception:
        sent = False

    if not sent:
        logger.info(
            "[email-token] purpose=%s user_id=%s email=%s url=%s",
            purpose,
            user.id,
            user.email,
            action_url,
        )

    return raw, action_url, sent


async def _lookup_token_row(db: AsyncSession, raw_token: str) -> tuple[EmailVerificationToken, User]:
    token_hash = _hash_token(raw_token.strip())
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(EmailVerificationToken, User)
        .join(User, User.id == EmailVerificationToken.user_id)
        .where(EmailVerificationToken.token_hash == token_hash)
    )
    row = result.first()
    if not row:
        raise ValueError("invalid")
    evt, user = row

    exp = evt.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.id == evt.id))
        await db.flush()
        raise ValueError("expired")

    return evt, user


async def inspect_email_token(db: AsyncSession, raw_token: str) -> dict:
    evt, user = await _lookup_token_row(db, raw_token)
    return {
        "valid": True,
        "purpose": evt.purpose,
        "email_masked": _mask_email(user.email),
    }


async def complete_email_token(db: AsyncSession, raw_token: str, password: str) -> User:
    evt, user = await _lookup_token_row(db, raw_token)

    user.hashed_password = hash_password(password)
    if evt.purpose == PURPOSE_VERIFY_EMAIL:
        user.email_verified = True

    await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.id == evt.id))
    await db.flush()
    return user
