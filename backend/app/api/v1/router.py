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
