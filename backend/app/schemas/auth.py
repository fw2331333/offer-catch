"""
请求/响应 DTO（Data Transfer Object）。

Pydantic 负责：JSON 反序列化、类型校验、自动生成 OpenAPI 文档（/docs）。
ORM 转 JSON 用 model_config = {"from_attributes": True}（见 UserResponse）。
"""
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):

    email: EmailStr

    username: str = Field(min_length=2, max_length=50)





class LoginRequest(BaseModel):

    email: EmailStr

    password: str





class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "bearer"





class RegisterResponse(BaseModel):

    message: str

    email: str

    email_sent: bool = True

    dev_verify_url: str | None = None





class ResendVerificationRequest(BaseModel):

    email: EmailStr





class ForgotPasswordRequest(BaseModel):

    email: EmailStr





class MessageResponse(BaseModel):
    message: str
    email_sent: bool = False
    dev_verify_url: str | None = None





class EmailTokenRequest(BaseModel):

    token: str = Field(min_length=16)





class InspectTokenResponse(BaseModel):

    valid: bool

    purpose: str

    email_masked: str





class CompleteTokenRequest(BaseModel):

    token: str = Field(min_length=16)

    password: str = Field(min_length=6, max_length=72)





class CompleteTokenResponse(BaseModel):

    message: str

    email: str





class UserResponse(BaseModel):

    id: int

    email: str

    username: str

    email_verified: bool



    model_config = {"from_attributes": True}


