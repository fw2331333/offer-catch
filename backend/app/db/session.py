"""
数据库连接与会话。

DATABASE_URL 使用 postgresql+asyncpg://… 才能配合 async/await。
每个 HTTP 请求通过 Depends(get_db) 拿到独立 session，请求结束自动关闭。
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
# expire_on_commit=False：commit 后仍可读已加载对象属性，适合返回 ORM 给 Pydantic
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类，create_all 只认继承它的类。"""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：yield 之后的路由执行完会走 finally，关闭 session。"""
    async with async_session() as session:
        yield session
