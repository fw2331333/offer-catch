from app.core.config import get_settings
from app.core.crypto import decrypt_secret
from app.models.user import User


def resolve_deepseek_api_key(user: User | None) -> str | None:
    """用户自填 Key 优先，否则使用服务端 .env 配置。"""
    if user and user.encrypted_api_key:
        try:
            key = decrypt_secret(user.encrypted_api_key)
            if key.startswith("sk-"):
                return key
        except ValueError:
            pass
    settings = get_settings()
    fallback = (settings.deepseek_api_key or "").strip()
    return fallback if fallback.startswith("sk-") else None


def require_api_key(user: User) -> str:
    key = resolve_deepseek_api_key(user)
    if not key:
        raise ValueError("请先在侧边栏配置 DeepSeek API Key，或由管理员配置服务端密钥")
    return key
