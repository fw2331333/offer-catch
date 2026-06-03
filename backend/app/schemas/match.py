from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    limit: int = Field(default=30, ge=1, le=50)
    city: str | None = None
    job_type: str | None = None


class MatchListItem(BaseModel):
    job_id: int
    company: str
    title: str
    city: str
    analysis_status: str = "pending"  # pending | analyzing | completed | failed
    progress: int = 0
    overall_score: float | None = None
    dimension_scores: dict | None = None
    explanation: str = ""
    recommendation: str = ""
    rule_score: float | None = None


class RecommendResponse(BaseModel):
    items: list[MatchListItem]
    resume_uploaded: bool
    profile_complete: bool
    batch_size: int = 5


class AnalyzeBatchRequest(BaseModel):
    job_ids: list[int] = Field(..., min_length=1, max_length=5)


class MatchReportResponse(BaseModel):
    job_id: int
    company: str
    title: str
    overall_score: float
    matched_items: list[dict]
    gaps: list[dict]
    risks: list[str]
    recommendation: str
    summary: str
