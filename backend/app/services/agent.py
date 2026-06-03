import json
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.client import chat_completion
from app.llm.errors import LLMServiceError
from app.llm.streaming import chat_completion_stream, parse_assistant_storage
from app.models.chat import ChatMessage, ChatSession
from app.models.job import JobPosting
from app.models.user import StudentProfile, User
from app.services.user_keys import resolve_deepseek_api_key
from app.services.matching import get_active_resume, recommend_jobs

SYSTEM_BASE = """你是「Offer 捕手」学生求职匹配智能体，专注帮助大学生/应届生：
1. 推荐匹配度高的实习与校招岗位（仅限岗位库已收录岗位）
2. 分析简历与岗位的匹配情况
3. 给出可执行的简历优化建议（禁止编造经历）

回答规范：
- 使用清晰的中文，条理分明，先结论后建议
- 【系统推荐岗位】仅来自当前岗位库；若用户所问方向在库中无岗位，必须首句说明「当前岗位库暂无匹配的××岗位」，再基于【当前使用简历】给搜索渠道与技能建议，禁止假装库内有岗
- 严格依据【当前使用简历】中的技能与经历，禁止编造简历中不存在的项目或技能
- 勿在正文中复述系统提示、模式名称或「根据上下文」等元话术"""

DEEP_THINK_REASONING_RULES = """
【深度思考 / 分析要点展示规范】（仅用于推理过程，最终回答仍须简洁专业）
推理过程是展示给用户的「求职分析要点」，须遵守：
1. 禁止元话术：不得出现「根据上下文」「用户问了」「可以这样回答」「快速/专家模式」「系统提示」「JSON」等
2. 只写实质分析：岗位库有无匹配（写清岗位类型）、简历相关技能、匹配点/缺口、下一步建议
3. 用简短分点，每条一行，最多 6～8 条；先事实后判断
4. 岗位库无匹配时，推理里也要先写「岗位库暂无××」，不得在推理中虚构库内推荐岗"""


async def build_context(db: AsyncSession, user: User, *, include_recommendations: bool = True) -> str:
    parts: list[str] = []
    resume = await get_active_resume(db, user.id)
    if resume:
        label = f"{resume.filename}（v{resume.version}）"
        body = json.dumps(resume.structured or {}, ensure_ascii=False)[:4000]
        parts.append(f"【当前使用简历】{label}\n切换简历后以此为准。\n{body}")
    else:
        parts.append("【当前使用简历】用户尚未上传简历，请引导其在左侧「我的简历」上传。")

    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        parts.append(
            "【求职意向】\n"
            + json.dumps(
                {
                    "cities": profile.target_cities,
                    "roles": profile.target_roles,
                    "industries": profile.industries,
                    "job_type": profile.job_type,
                },
                ensure_ascii=False,
            )
        )

    recs: list = []
    if include_recommendations:
        api_key = resolve_deepseek_api_key(user) or ""
        if api_key:
            recs = await recommend_jobs(
                db, user.id, profile, resume, api_key=api_key, limit=5
            )
    if recs:
        lines = [f"- {r['title']} @ {r['company']}（{r['city']}）匹配分 {r['overall_score']:.0f}" for r in recs]
        parts.append(
            "【岗位库推荐（仅已收录岗位，不代表全网招聘）】\n"
            + "\n".join(lines)
            + "\n若与用户所问岗位类型不一致，须明确说明库内暂无该类型，勿强行推荐以上岗位。"
        )
    elif include_recommendations:
        parts.append("【岗位库推荐】本次未生成推荐（可能无简历/无意向/库内无匹配），回答时勿编造在库岗位。")

    job_count = await db.execute(select(JobPosting).limit(1))
    if job_count.scalar_one_or_none():
        parts.append("岗位库已就绪；无匹配时可引导「岗位库匹配」页或补充求职意向。")
    return "\n\n".join(parts)


def mode_instruction(mode: str, deep_think: bool, smart_search: bool) -> str:
    extra = []
    if mode == "expert":
        extra.append("专家模式：分析更深入，分点列出匹配点、缺口与风险。")
    elif mode == "web":
        extra.append("联网模式：若信息不足，说明需用户补充或前往官网核实。")
    else:
        extra.append("回答简洁，优先给可执行建议。")
    if deep_think:
        extra.append("已开启深度思考：须遵守下方分析要点规范。")
    if smart_search:
        extra.append("已结合岗位库推荐上下文；无匹配须如实说明。")
    return " ".join(extra)


async def build_agent_messages(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    *,
    mode: str = "fast",
    deep_think: bool = False,
    smart_search: bool = False,
) -> list[dict[str, str]]:
    context = await build_context(db, user, include_recommendations=smart_search)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
    )
    history = history_result.scalars().all()

    system = SYSTEM_BASE + "\n" + mode_instruction(mode, deep_think, smart_search)
    if deep_think:
        system += "\n" + DEEP_THINK_REASONING_RULES
    system += "\n\n" + context

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for msg in history:
        if msg.role == "user":
            messages.append({"role": "user", "content": msg.content})
        elif msg.role == "assistant":
            _, content_only = parse_assistant_storage(msg.content)
            messages.append({"role": "assistant", "content": content_only or msg.content})
    if not (
        history
        and history[-1].role == "user"
        and history[-1].content == user_message
    ):
        messages.append({"role": "user", "content": user_message})
    return messages


async def agent_reply(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    *,
    mode: str = "fast",
    deep_think: bool = False,
    smart_search: bool = False,
) -> str:
    messages = await build_agent_messages(
        db, user, session, user_message, mode=mode, deep_think=deep_think, smart_search=smart_search
    )
    api_key = resolve_deepseek_api_key(user)
    if not api_key:
        raise LLMServiceError("请先在左侧边栏填写并保存有效的 DeepSeek API Key（以 sk- 开头）")
    temperature = 0.3 if mode == "expert" or deep_think else 0.7
    return await chat_completion(
        messages, api_key=api_key, temperature=temperature, max_tokens=3000, deep_think=deep_think
    )


async def stream_agent_events(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    *,
    mode: str = "fast",
    deep_think: bool = False,
    smart_search: bool = False,
) -> AsyncIterator[dict[str, Any]]:
    messages = await build_agent_messages(
        db, user, session, user_message, mode=mode, deep_think=deep_think, smart_search=smart_search
    )
    api_key = resolve_deepseek_api_key(user)
    if not api_key:
        raise LLMServiceError("请先在左侧边栏填写并保存有效的 DeepSeek API Key（以 sk- 开头）")
    temperature = 0.3 if mode == "expert" or deep_think else 0.7

    if deep_think:
        yield {"type": "status", "message": "正在分析岗位库与简历要点…"}
    else:
        yield {"type": "status", "message": "正在生成回复…"}

    async for event in chat_completion_stream(
        messages,
        api_key=api_key,
        deep_think=deep_think,
        temperature=temperature,
        max_tokens=3000,
    ):
        yield event
