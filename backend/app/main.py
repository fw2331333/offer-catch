"""
FastAPI 应用入口。

请求路径：浏览器/前端 → Nginx(web) → 本服务(api) → PostgreSQL / Redis / DeepSeek API

学习要点：
- lifespan：启动时建表、跑迁移、连 Redis；关闭时释放连接
- CORSMiddleware：允许前端域名跨域带 Cookie/Authorization
- include_router：业务路由集中在 app/api/v1/
"""
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
    """应用生命周期：比在每个路由里 init 更干净，且保证顺序。"""
    settings = get_settings()
    ensure_upload_dir(settings.upload_dir)
    # create_all：按 ORM 模型建表（新表）；已有表不会删改列
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # 手写 SQL 迁移：给旧库补字段，可重复执行（幂等）
    await run_migrations()
    await init_redis()
    yield  # 此处之后服务开始接请求
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
    """把 LLM 调用错误统一成 JSON，前端好展示 detail。"""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health")
async def health():
    redis_ok = await redis_ping()
    status_text = "ok" if redis_ok else "degraded"
    return {"status": status_text, "service": "offer-catch", "redis": redis_ok}


@app.get("/")
async def root():
    return {"message": "Offer 捕手 API", "docs": "/docs"}
