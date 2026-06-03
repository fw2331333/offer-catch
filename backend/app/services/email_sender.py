"""
SMTP 发信。同步 smtplib 包在 asyncio.to_thread 里跑，避免阻塞事件循环。
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _envelope_from() -> str:
    settings = get_settings()
    _, addr = parseaddr(settings.smtp_from)
    return addr or settings.smtp_user


def _send_smtp_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    settings = get_settings()
    envelope = _envelope_from()
    _, from_addr = parseaddr(settings.smtp_from)
    display = settings.smtp_from.split("<", 1)[0].strip().strip('"') if "<" in settings.smtp_from else "Offer Catch"
    if not from_addr:
        from_addr = settings.smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((display or "Offer Catch", from_addr))
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # QQ 邮箱：587+STARTTLS 或 465+SSL 二选一
    if settings.smtp_port == 465:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
    with server:
        if settings.smtp_port != 465 and settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(envelope, [to_email], msg.as_string())


async def send_set_password_email(to_email: str, action_url: str, purpose: str) -> bool:
    """注册验证或重置密码邮件。未配置 SMTP 时返回 False。"""
    from app.models.email_verification import PURPOSE_RESET_PASSWORD

    settings = get_settings()
    if purpose == PURPOSE_RESET_PASSWORD:
        subject = "重置 Offer 捕手 密码"
        title = "重置密码"
        intro = "你申请了重置密码。请打开下方链接设置新密码："
        button = "设置新密码"
    else:
        subject = "完成 Offer 捕手 注册"
        title = "完成注册"
        intro = "欢迎注册 <strong>Offer 捕手</strong>。请打开下方链接设置登录密码并完成验证："
        button = "设置密码并验证"

    qq_tip = (
        "QQ 邮箱若提示 Invalid url：不要直接点按钮，请复制下方整段链接，"
        "粘贴到 Chrome / Edge 地址栏打开。"
    )
    text_body = (
        f"{title}\n\n"
        f"{intro.replace('<strong>', '').replace('</strong>', '')}\n"
        f"{action_url}\n\n"
        f"{qq_tip}\n\n"
        f"链接 {settings.email_verify_expire_hours} 小时内有效。如非本人操作请忽略。"
    )
    html_body = f"""
    <div style="font-family:sans-serif;line-height:1.6;color:#374151;max-width:480px">
      <h2 style="color:#1f2937">{title}</h2>
      <p>{intro}</p>
      <p><a href="{action_url}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
         text-decoration:none;border-radius:8px">{button}</a></p>
      <p style="font-size:13px;color:#6b7280">或复制链接到 Chrome / Edge：<br>
        <span style="word-break:break-all">{action_url}</span></p>
      <p style="font-size:12px;color:#b45309;background:#fffbeb;padding:8px;border-radius:6px">
        {qq_tip}</p>
      <p style="font-size:12px;color:#9ca3af">链接 {settings.email_verify_expire_hours} 小时内有效。</p>
    </div>
    """

    if not settings.smtp_configured:
        logger.warning(
            "[email] SMTP 未配置，邮件未发送。链接: %s",
            action_url,
        )
        return False

    try:
        await asyncio.to_thread(_send_smtp_sync, to_email, subject, html_body, text_body)
        logger.info("[email] 邮件已发送至 %s purpose=%s", to_email, purpose)
        return True
    except Exception:
        logger.exception("[email] 发送邮件失败: %s", to_email)
        raise
