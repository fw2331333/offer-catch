from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    job_type: Mapped[str] = mapped_column(String(50), default="实习")
    salary_min: Mapped[int | None] = mapped_column(Integer, default=None)
    salary_max: Mapped[int | None] = mapped_column(Integer, default=None)
    industry: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[dict | None] = mapped_column(JSONB, default=None)
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    source: Mapped[str] = mapped_column(String(30), default="seed", index=True)
    source_url: Mapped[str | None] = mapped_column(String(500), default=None)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
