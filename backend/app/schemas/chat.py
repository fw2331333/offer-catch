from datetime import datetime

from pydantic import BaseModel, Field


class ChatSessionCreate(BaseModel):
    title: str = "新对话"
    mode: str = "fast"


class ChatSessionResponse(BaseModel):
    id: int
    title: str
    mode: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSendRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: int | None = None
    mode: str = "fast"
    deep_think: bool = False
    smart_search: bool = False


class ChatSendResponse(BaseModel):
    session_id: int
    reply: str
    messages: list[ChatMessageResponse]
