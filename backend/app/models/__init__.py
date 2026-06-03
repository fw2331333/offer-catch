# 在 main.py / init_db 里 import app.models，确保所有表注册到 Base.metadata
from app.models.chat import ChatMessage, ChatSession
from app.models.job import JobPosting
from app.models.match import MatchResult
from app.models.resume import Resume
from app.models.email_verification import EmailVerificationToken
from app.models.user import StudentProfile, User

__all__ = [
    "User",
    "StudentProfile",
    "EmailVerificationToken",
    "Resume",
    "JobPosting",
    "MatchResult",
    "ChatSession",
    "ChatMessage",
]
