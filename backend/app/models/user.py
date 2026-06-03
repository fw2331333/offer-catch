from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(255))
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, default=None)
    email_verified: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False)
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    target_cities: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_roles: Mapped[list | None] = mapped_column(JSONB, default=list)
    industries: Mapped[list | None] = mapped_column(JSONB, default=list)
    salary_min: Mapped[int | None] = mapped_column(default=None)
    salary_max: Mapped[int | None] = mapped_column(default=None)
    job_type: Mapped[str | None] = mapped_column(String(50), default="实习")
    bio: Mapped[str | None] = mapped_column(Text, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="profile")


from app.models.chat import ChatSession  # noqa: E402
from app.models.email_verification import EmailVerificationToken  # noqa: E402
from app.models.resume import Resume  # noqa: E402
