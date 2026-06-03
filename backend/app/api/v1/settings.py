from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.crypto import decrypt_secret, encrypt_secret, mask_api_key
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.settings import ApiKeyStatusResponse, ApiKeyUpdateRequest, ApiKeyUpdateResponse

router = APIRouter(prefix="/settings", tags=["设置"])


@router.get("/api-key", response_model=ApiKeyStatusResponse)
async def get_api_key_status(user: User = Depends(get_current_user)):
    settings = get_settings()
    if user.encrypted_api_key:
        try:
            plain = decrypt_secret(user.encrypted_api_key)
            return ApiKeyStatusResponse(
                configured=True,
                masked=mask_api_key(plain),
                using_server_fallback=False,
            )
        except ValueError:
            pass
    if settings.deepseek_api_key:
        return ApiKeyStatusResponse(
            configured=True,
            masked=mask_api_key(settings.deepseek_api_key),
            using_server_fallback=True,
        )
    return ApiKeyStatusResponse(configured=False)


@router.put("/api-key", response_model=ApiKeyUpdateResponse)
async def save_api_key(
    body: ApiKeyUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = body.api_key.strip().replace(" ", "")
    if not key.startswith("sk-") or len(key) < 20:
        raise HTTPException(400, detail="请填写有效的 DeepSeek API Key（以 sk- 开头）")
    user.encrypted_api_key = encrypt_secret(key)
    await db.commit()
    return ApiKeyUpdateResponse(configured=True, masked=mask_api_key(key))


@router.delete("/api-key", status_code=204)
async def delete_api_key(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.encrypted_api_key = None
    await db.commit()
