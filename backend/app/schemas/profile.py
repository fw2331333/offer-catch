from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    target_cities: list[str] = Field(default_factory=list)
    target_roles: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    salary_min: int | None = None
    salary_max: int | None = None
    job_type: str = "实习"
    bio: str | None = None


class ProfileResponse(ProfileUpdate):
    user_id: int

    model_config = {"from_attributes": True}
