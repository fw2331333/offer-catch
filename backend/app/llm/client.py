"""
调用 DeepSeek（OpenAI 兼容 API）。

用户 Key 优先于环境变量 DEEPSEEK_API_KEY；错误统一转成 LLMServiceError 由 main.py 处理。
"""
import json
import re
from typing import Any

from openai import APIError, APIConnectionError, APITimeoutError, AuthenticationError, RateLimitError

from app.core.config import get_settings
from app.llm.client_base import get_llm_client
from app.llm.errors import LLMServiceError


def _wrap_openai_error(exc: Exception) -> LLMServiceError:
    if isinstance(exc, AuthenticationError):
        return LLMServiceError(
            "DeepSeek API Key 无效或已过期，请在左侧边栏重新填写并保存（以 sk- 开头）",
            status_code=401,
        )
    if isinstance(exc, RateLimitError):
        return LLMServiceError("AI 调用过于频繁，请稍后再试", status_code=429)
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return LLMServiceError("无法连接 DeepSeek 服务，请检查网络后重试", status_code=503)
    if isinstance(exc, APIError):
        msg = getattr(exc, "message", None) or str(exc)
        return LLMServiceError(f"AI 服务错误：{msg}", status_code=502)
    return LLMServiceError(f"AI 服务异常：{exc}", status_code=500)


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    api_key: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    deep_think: bool = False,
) -> str:
    settings = get_settings()
    api_key = (api_key or "").strip()
    if not api_key:
        raise LLMServiceError("请先在侧边栏配置 DeepSeek API Key 后再使用 AI 功能")
    model = settings.deepseek_reasoner_model if deep_think else settings.deepseek_model
    client = get_llm_client(api_key)
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""
    except LLMServiceError:
        raise
    except Exception as e:
        raise _wrap_openai_error(e) from e


def extract_json(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


async def structured_completion(
    system: str,
    user: str,
    *,
    api_key: str,
) -> dict | list | None:
    content = await chat_completion(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        api_key=api_key,
        temperature=0.2,
    )
    data = extract_json(content)
    return data if isinstance(data, (dict, list)) else None
