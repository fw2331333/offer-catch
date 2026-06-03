from datetime import datetime

from pydantic import BaseModel


class ResumeResponse(BaseModel):
    id: int
    filename: str
    version: int
    is_active: bool
    structured: dict | None
    created_at: datetime
    preview: str | None = None

    model_config = {"from_attributes": True}


class ResumeListResponse(BaseModel):
    items: list[ResumeResponse]
    active_id: int | None = None


class OptimizeRequest(BaseModel):
    job_id: int


class OptimizeResponse(BaseModel):
    job_id: int
    job_title: str
    company: str
    before_score: float
    suggestions: list[dict]
    rewritten_sections: list[dict]
    summary: str
