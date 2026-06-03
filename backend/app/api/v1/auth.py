"""
认证相关 HTTP 接口。

注册流程（无密码表单）：
  register → 邮件里的 token → complete-email-token 设密码 → login 拿 JWT

安全设计：
  - 库中只存 token 的 SHA256，链接里带明文 token（类似重置密码最佳实践）
  - 未验证用户用随机占位密码，防止空密码登录
  - 登录/忘记密码用 Redis 限流（见 rate_limit.py）
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.redis_client import get_redis
from app.core.request_utils import client_ip
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.email_verification import PURPOSE_RESET_PASSWORD, PURPOSE_VERIFY_EMAIL
from app.models.user import StudentProfile, User
from app.schemas.auth import (
    CompleteTokenRequest,
    CompleteTokenResponse,
    EmailTokenRequest,
    ForgotPasswordRequest,
    InspectTokenResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
)
from app.services.email_verification import (
    complete_email_token,
    inspect_email_token,
    issue_email_token,
    should_expose_dev_link,
)
from app.services.rate_limit import (
    check_forgot_password_allowed,
    check_login_allowed,
    clear_login_failures,
    record_forgot_password,
    record_login_failure,
)

router = APIRouter(prefix="/auth", tags=["认证"])


def _placeholder_password_hash() -> str:
    """注册时尚未设密码，先写入随机哈希，只有通过邮件链接才能改成真密码。"""
    return hash_password(secrets.token_urlsafe(32))


async def _send_token_for_user(
    db: AsyncSession, user: User, purpose: str
) -> tuple[str | None, bool]:
    """发令牌邮件；开发环境未配 SMTP 时可能返回 dev_verify_url 给前端展示。"""
    _, action_url, sent = await issue_email_token(db, user, purpose)
    await db.commit()
    dev_url = action_url if should_expose_dev_link(sent) else None
    return dev_url, sent


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # 邮箱统一小写，避免 user@x.com 与 User@x.com 当成两个账号
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()

    if existing:
        # 一邮箱一账号：已验证不可覆盖；未验证也不重复发注册，走忘记密码/重发
        if existing.email_verified:
            raise HTTPException(
                status_code=400,
                detail="该邮箱已注册，请直接登录或使用忘记密码",
            )
        raise HTTPException(
            status_code=400,
            detail="该邮箱已注册但未完成验证，请使用「忘记密码」重发设置密码邮件",
        )

    user = User(
        email=email,
        username=body.username,
        hashed_password=_placeholder_password_hash(),
        email_verified=False,
    )
    db.add(user)
    await db.flush()  # flush 后 user.id 才有值，才能建关联的 StudentProfile
    db.add(StudentProfile(user_id=user.id, target_cities=[], target_roles=[], industries=[]))

    dev_url, sent = await _send_token_for_user(db, user, PURPOSE_VERIFY_EMAIL)
    if sent:
        message = "验证邮件已发送，请打开链接设置密码并完成注册"
    elif dev_url:
        message = "未配置发信，请使用下方链接设置密码"
    else:
        message = "邮件发送失败，请检查 SMTP 配置后重试"
    return RegisterResponse(
        message=message,
        email=email,
        email_sent=sent,
        dev_verify_url=dev_url,
    )


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(body: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # 无论邮箱是否存在都返回模糊文案，防止攻击者枚举已注册邮箱
    if not user or user.email_verified:
        return MessageResponse(
            message="若该邮箱已注册且未验证，你将收到设置密码邮件",
            email_sent=False,
        )

    redis = get_redis()
    await check_forgot_password_allowed(redis, email)

    dev_url, sent = await _send_token_for_user(db, user, PURPOSE_VERIFY_EMAIL)
    if sent:
        await record_forgot_password(redis, email)
    message = (
        "设置密码邮件已发送，请查收（含垃圾箱）"
        if sent
        else "邮件发送失败，请检查 SMTP 配置"
    )
    return MessageResponse(message=message, email_sent=sent, dev_verify_url=dev_url)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        return MessageResponse(
            message="若该邮箱已注册，你将收到相关邮件",
            email_sent=False,
        )  # 同上：不泄露「该邮箱未注册」

    redis = get_redis()
    await check_forgot_password_allowed(redis, email)

    if not user.email_verified:
        dev_url, sent = await _send_token_for_user(db, user, PURPOSE_VERIFY_EMAIL)
        if sent:
            await record_forgot_password(redis, email)
        message = (
            "该邮箱尚未完成验证，已发送「设置密码」邮件，请打开链接完成验证后再登录"
            if sent
            else "邮件发送失败，请检查 SMTP 配置"
        )
        return MessageResponse(message=message, email_sent=sent, dev_verify_url=dev_url)

    dev_url, sent = await _send_token_for_user(db, user, PURPOSE_RESET_PASSWORD)
    if sent:
        await record_forgot_password(redis, email)
    message = (
        "重置密码邮件已发送，请查收（含垃圾箱）"
        if sent
        else "邮件发送失败，请检查 SMTP 配置"
    )
    return MessageResponse(message=message, email_sent=sent, dev_verify_url=dev_url)


@router.post("/inspect-email-token", response_model=InspectTokenResponse)
async def inspect_token(body: EmailTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await inspect_email_token(db, body.token.strip())
    except ValueError as e:
        code = str(e)
        if code == "expired":
            raise HTTPException(status_code=400, detail="链接已过期，请重新注册或申请重置密码")
        raise HTTPException(status_code=400, detail="链接无效")
    return InspectTokenResponse(**data)


@router.post("/complete-email-token", response_model=CompleteTokenResponse)
async def complete_token(body: CompleteTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await complete_email_token(db, body.token.strip(), body.password)
        await db.commit()
    except ValueError as e:
        code = str(e)
        if code == "expired":
            raise HTTPException(status_code=400, detail="链接已过期，请重新注册或申请重置密码")
        raise HTTPException(status_code=400, detail="链接无效")

    return CompleteTokenResponse(
        message="密码已设置，请使用邮箱和新密码登录",
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    email = body.email.strip().lower()
    ip = client_ip(request)  # 限流同时看邮箱与 IP
    redis = get_redis()
    await check_login_allowed(redis, email, ip)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        await record_login_failure(redis, email, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="邮箱尚未验证，请查收邮件完成设置密码，或使用忘记密码重发",
        )
    await clear_login_failures(redis, email, ip)
    # 前端保存 access_token，之后请求头：Authorization: Bearer <token>
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
