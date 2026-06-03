import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.redis_client import close_redis, init_redis, redis_ping
from app.db.migrate import run_migrations
from app.db.session import Base, engine
import app.models  # noqa: F401 — register ORM models
from app.llm.errors import LLMServiceError
from app.services.resume_parser import ensure_upload_dir


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    ensure_upload_dir(settings.upload_dir)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_migrations()
    await init_redis()
    yield
    await close_redis()


app = FastAPI(
    title="Offer 捕手 API",
    description="学生求职匹配智能体",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(LLMServiceError)
async def llm_service_error_handler(_: Request, exc: LLMServiceError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health")
async def health():
    redis_ok = await redis_ping()
    status_text = "ok" if redis_ok else "degraded"
    return {"status": status_text, "service": "offer-catch", "redis": redis_ok}


@app.get("/")
async def root():
    return {"message": "Offer 捕手 API", "docs": "/docs"}
