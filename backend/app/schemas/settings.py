from pydantic import BaseModel, Field


class ApiKeyStatusResponse(BaseModel):
    configured: bool
    masked: str | None = None
    using_server_fallback: bool = False


class ApiKeyUpdateRequest(BaseModel):
    api_key: str = Field(min_length=10, max_length=200)


class ApiKeyUpdateResponse(BaseModel):
    configured: bool
    masked: str
