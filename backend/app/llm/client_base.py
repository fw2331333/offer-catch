from openai import AsyncOpenAI

from app.core.config import get_settings


def get_llm_client(api_key: str) -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=api_key.strip(), base_url=settings.deepseek_base_url)
