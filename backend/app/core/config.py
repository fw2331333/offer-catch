"""
全局配置：从 .env / 环境变量读取，类型由 Pydantic 校验。

字段名规则：环境变量 EMAIL_VERIFY_EXPIRE_HOURS → email_verify_expire_hours
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # env_file：本地与 Docker 都把 .env 挂进容器，compose 的 env_file 也会注入
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_reasoner_model: str = "deepseek-reasoner"

    jwt_secret: str = "dev-secret"
    jwt_expire_minutes: int = 10080
    jwt_algorithm: str = "HS256"

    database_url: str = "postgresql+asyncpg://offer:offer123@localhost:5432/offer_catch"
    redis_url: str = "redis://localhost:6379/0"

    # 登录限流（Redis）
    login_rate_limit_max_attempts: int = 5
    login_rate_limit_max_ip_attempts: int = 30
    login_rate_limit_window_seconds: int = 900
    forgot_password_rate_limit_max: int = 3
    forgot_password_rate_limit_window_seconds: int = 3600

    # 热点缓存 TTL（秒）
    cache_ttl_jobs_list: int = 60
    cache_ttl_job_detail: int = 300
    cache_ttl_profile: int = 120

    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"
    max_upload_mb: int = 10

    # 邮件验证（前端验证页基址，用于生成链接）
    app_public_url: str = "http://localhost:8080"
    email_verify_expire_hours: int = 24
    # 未配置 SMTP 时，在 API 响应与日志中暴露验证链接（仅开发）
    expose_dev_verify_link: bool = True

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def smtp_configured(self) -> bool:
        return bool(
            self.smtp_host
            and self.smtp_user
            and self.smtp_password
            and self.smtp_from
        )


@lru_cache
def get_settings() -> Settings:
    """单例配置，进程内只解析一次 .env。"""
    return Settings()
