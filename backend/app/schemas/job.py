from datetime import datetime

from pydantic import BaseModel, Field


class JobRequirements(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    education: str = ""


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    job_type: str = "实习"
    salary_min: int | None = None
    salary_max: int | None = None
    industry: str | None = None
    description: str = Field(min_length=10)
    requirements: JobRequirements | dict | None = None
    tags: list[str] = Field(default_factory=list)


class JobUpdate(BaseModel):
    company: str | None = None
    title: str | None = None
    city: str | None = None
    job_type: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    industry: str | None = None
    description: str | None = None
    requirements: JobRequirements | dict | None = None
    tags: list[str] | None = None


class JobListItem(BaseModel):
    id: int
    company: str
    title: str
    city: str
    job_type: str
    salary_min: int | None
    salary_max: int | None
    industry: str | None
    tags: list | None
    source: str | None = "seed"
    source_url: str | None = None
    is_mine: bool = False
    is_shared: bool = False
    shared_by_username: str | None = None

    model_config = {"from_attributes": True}


class JobShareUpdate(BaseModel):
    shared: bool


class JobDetail(JobListItem):
    description: str
    requirements: dict | None
    created_by_user_id: int | None = None
    created_at: datetime
    can_edit: bool = False
    can_share: bool = False


class AiSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500, description="自然语言搜索，如：上海数据分析实习")
    limit: int = Field(default=8, ge=1, le=15)
    include_ai_discovery: bool = True
    city: str | None = Field(default=None, description="优先使用的目标城市")
    job_type: str | None = Field(default=None, description="实习/校招等")
    roles: list[str] = Field(default_factory=list, description="岗位方向关键词")


class AiDiscoveredJob(BaseModel):
    company: str
    title: str
    city: str
    job_type: str = "实习"
    salary_min: int | None = None
    salary_max: int | None = None
    industry: str | None = None
    description: str
    requirements: dict | None = None
    tags: list[str] = Field(default_factory=list)
    relevance_reason: str = ""
    verify_note: str = "请到公司官网或正规招聘平台核实后再投递"
    source_url: str | None = None


class LocalSearchHit(JobListItem):
    match_reason: str = ""


class AiSearchResponse(BaseModel):
    query: str
    search_summary: str
    local_jobs: list[LocalSearchHit]
    ai_discovered: list[AiDiscoveredJob]


class AiImportRequest(BaseModel):
    jobs: list[AiDiscoveredJob]


class AiImportResponse(BaseModel):
    imported: list[JobListItem]
    count: int


class ParseTextRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    save: bool = True


class ParsedJobPreview(BaseModel):
    company: str
    title: str
    city: str
    job_type: str
    salary_min: int | None = None
    salary_max: int | None = None
    industry: str | None = None
    description: str
    requirements: dict | None = None
    tags: list[str] = Field(default_factory=list)
    parse_note: str = ""


class ParseJobResponse(BaseModel):
    source_type: str
    extracted_text: str
    parsed: ParsedJobPreview
    job: JobDetail | None = None


class JobResumeAnalysisResponse(BaseModel):
    job_id: int
    job_title: str
    company: str
    has_resume: bool
    overall_score: float
    recommendation: str
    match_summary: str
    matched_items: list[dict]
    gaps: list[dict]
    risks: list[str]
    optimization_summary: str
    suggestions: list[dict]
