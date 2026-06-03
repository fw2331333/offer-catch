import json
from collections.abc import AsyncIterator
from typing import Any

from app.core.config import get_settings
from app.llm.client import _wrap_openai_error
from app.llm.client_base import get_llm_client
from app.llm.errors import LLMServiceError

THINK_OPEN = "[[[THINK]]]"
THINK_CLOSE = "[[[/THINK]]]"


async def chat_completion_stream(
    messages: list[dict[str, str]],
    *,
    api_key: str,
    deep_think: bool = False,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncIterator[dict[str, Any]]:
    """产出 SSE 事件块：thinking / content / error。"""
    settings = get_settings()
    api_key = (api_key or "").strip()
    if not api_key:
        raise LLMServiceError("请先在侧边栏配置 DeepSeek API Key 后再使用 AI 功能")

    model = settings.deepseek_reasoner_model if deep_think else settings.deepseek_model
    client = get_llm_client(api_key)

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                yield {"type": "thinking", "delta": reasoning}
            content = getattr(delta, "content", None)
            if content:
                yield {"type": "content", "delta": content}
    except LLMServiceError:
        raise
    except Exception as e:
        raise _wrap_openai_error(e) from e


def format_assistant_storage(thinking: str, content: str) -> str:
    """持久化到数据库：含思考过程时加标记，前端可解析展示。"""
    thinking = (thinking or "").strip()
    content = (content or "").strip()
    if thinking:
        return f"{THINK_OPEN}\n{thinking}\n{THINK_CLOSE}\n\n{content}"
    return content


def parse_assistant_storage(text: str) -> tuple[str, str]:
    text = text or ""
    if THINK_OPEN in text and THINK_CLOSE in text:
        start = text.index(THINK_OPEN) + len(THINK_OPEN)
        end = text.index(THINK_CLOSE)
        thinking = text[start:end].strip()
        rest = text[end + len(THINK_CLOSE) :].strip()
        return thinking, rest
    return "", text


def sse_line(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
