import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet() -> Fernet:
    secret = get_settings().jwt_secret.encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8").strip()
    except InvalidToken as e:
        raise ValueError("解密失败") from e


def mask_api_key(key: str) -> str:
    key = key.strip()
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}...{key[-4:]}"
