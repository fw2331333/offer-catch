"""
将各业务模块的路由挂到同一前缀 /api/v1 下。

例如 auth.router 自带 prefix="/auth" → 完整路径 /api/v1/auth/login
"""
from fastapi import APIRouter

from app.api.v1 import auth, chat, jobs, match, profile, resumes, settings

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(settings.router)
api_router.include_router(profile.router)
api_router.include_router(resumes.router)
api_router.include_router(jobs.router)
api_router.include_router(match.router)
api_router.include_router(chat.router)
