import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.llm.client import structured_completion
from app.llm.errors import LLMServiceError
from app.models.job import JobPosting
from app.models.resume import Resume
from app.models.user import StudentProfile
from app.services.match_cache import (
    clear_user_match_results,
    get_match_result,
    match_dict_to_list_item,
    report_from_match,
    upsert_match_result,
)

MATCH_PROMPT = """你是校招求职匹配专家。根据学生画像、简历与岗位JD，输出 JSON：
{
  "overall_score": 0-100,
  "dimension_scores": {"intent": 0-100, "skills": 0-100, "experience": 0-100, "education": 0-100},
  "explanation": "2-4句中文推荐理由",
  "recommendation": "strong|try|skip",
  "matched_items": [{"item": "", "evidence": ""}],
  "gaps": [{"item": "", "suggestion": ""}],
  "risks": ["..."],
  "summary": "一段总结"
}
评分要客观，禁止编造简历中不存在的经历。只输出 JSON。"""

BATCH_SIZE = 5


def _profile_text(profile: StudentProfile | None) -> str:
    if not profile:
        return "（未填写求职意向）"
    return json.dumps(
        {
            "target_cities": profile.target_cities or [],
            "target_roles": profile.target_roles or [],
            "industries": profile.industries or [],
            "salary": [profile.salary_min, profile.salary_max],
            "job_type": profile.job_type,
            "bio": profile.bio,
        },
        ensure_ascii=False,
    )


def _resume_text(resume: Resume | None) -> str:
    if not resume:
        return "（未上传简历）"
    if resume.structured:
        return json.dumps(resume.structured, ensure_ascii=False)[:8000]
    return (resume.raw_text or "")[:8000]


def _job_text(job: JobPosting) -> str:
    req = json.dumps(job.requirements or {}, ensure_ascii=False)
    return f"公司:{job.company}\n岗位:{job.title}\n城市:{job.city}\n类型:{job.job_type}\n行业:{job.industry}\n描述:\n{job.description}\n要求:{req}"


def rule_prefilter_score(job: JobPosting, profile: StudentProfile | None) -> float:
    score = 50.0
    if profile:
        cities = profile.target_cities or []
        if cities and job.city in cities:
            score += 15
        roles = profile.target_roles or []
        if roles and any(r in job.title for r in roles):
            score += 15
        if profile.job_type and profile.job_type == job.job_type:
            score += 10
    return min(score, 95.0)


async def score_job_match(
    job: JobPosting,
    resume: Resume | None,
    profile: StudentProfile | None,
    *,
    api_key: str,
    use_llm: bool = True,
) -> dict[str, Any]:
    base = rule_prefilter_score(job, profile)
    if not use_llm or not resume:
        return {
            "overall_score": base,
            "dimension_scores": {
                "intent": base,
                "skills": max(base - 5, 0),
                "experience": max(base - 5, 0),
                "education": base,
            },
            "explanation": "请先上传简历并配置 API Key 后使用 AI 精排",
            "recommendation": "try" if base >= 60 else "skip",
            "matched_items": [],
            "gaps": [],
            "risks": [],
            "summary": "请上传简历以获取 AI 匹配分析。",
        }

    data = await structured_completion(
        MATCH_PROMPT,
        f"学生画像：\n{_profile_text(profile)}\n\n简历：\n{_resume_text(resume)}\n\n岗位：\n{_job_text(job)}",
        api_key=api_key,
    )
    if not isinstance(data, dict):
        raise LLMServiceError("AI 匹配分析返回格式异常，请重试")
    data.setdefault("overall_score", base)
    data.setdefault("recommendation", "try")
    return data


async def get_active_resume(db: AsyncSession, user_id: int) -> Resume | None:
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id, Resume.is_active.is_(True))
        .order_by(Resume.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def rank_jobs_for_recommend(
    db: AsyncSession,
    profile: StudentProfile | None,
    *,
    city: str | None = None,
    job_type: str | None = None,
    limit: int = 30,
) -> list[tuple[JobPosting, float]]:
    q = select(JobPosting)
    if city:
        q = q.where(JobPosting.city == city)
    if job_type:
        q = q.where(JobPosting.job_type == job_type)
    result = await db.execute(q)
    jobs = list(result.scalars().all())
    scored = [(job, rule_prefilter_score(job, profile)) for job in jobs]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


async def init_recommend_queue(
    db: AsyncSession,
    user_id: int,
    ranked: list[tuple[JobPosting, float]],
) -> list[dict[str, Any]]:
    await clear_user_match_results(db, user_id)
    items: list[dict[str, Any]] = []
    for job, rule_score in ranked:
        await upsert_match_result(
            db,
            user_id,
            job.id,
            analysis_status="pending",
            progress=0,
            overall_score=None,
            explanation="",
            report=None,
        )
        row = await get_match_result(db, user_id, job.id)
        items.append(match_dict_to_list_item(job, row, rule_score=rule_score))
    await db.commit()
    return items


async def load_recommend_list(
    db: AsyncSession,
    user_id: int,
    ranked: list[tuple[JobPosting, float]],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for job, rule_score in ranked:
        row = await get_match_result(db, user_id, job.id)
        items.append(match_dict_to_list_item(job, row, rule_score=rule_score))
    return items


def sse_match(payload: dict[str, Any]) -> str:
    import json as _json

    return f"data: {_json.dumps(payload, ensure_ascii=False)}\n\n"


async def analyze_jobs_stream(
    user_id: int,
    job_ids: list[int],
    api_key: str,
) -> AsyncIterator[str]:
    """逐个 AI 分析岗位，SSE 推送进度；与单独拉报告可并发。"""
    total = len(job_ids)
    for index, job_id in enumerate(job_ids):
        async with async_session() as db:
            row = await get_match_result(db, user_id, job_id)
            job = await db.get(JobPosting, job_id)
            if row and row.analysis_status == "completed" and row.report and job:
                item = match_dict_to_list_item(job, row, rule_score=None)
                yield sse_match(
                    {
                        "type": "job_done",
                        "job_id": job_id,
                        "index": index + 1,
                        "total": total,
                        "progress": 100,
                        "item": item,
                        "cached": True,
                    }
                )
                continue

        yield sse_match(
            {
                "type": "job_start",
                "job_id": job_id,
                "index": index + 1,
                "total": total,
                "progress": 0,
            }
        )

        async def run_llm() -> dict[str, Any]:
            async with async_session() as db:
                job = await db.get(JobPosting, job_id)
                if not job:
                    raise LLMServiceError("岗位不存在")
                result = await db.execute(
                    select(StudentProfile).where(StudentProfile.user_id == user_id)
                )
                profile = result.scalar_one_or_none()
                resume = await get_active_resume(db, user_id)
                return await score_job_match(job, resume, profile, api_key=api_key, use_llm=True)

        llm_task = asyncio.create_task(run_llm())
        tick = 12
        while not llm_task.done():
            async with async_session() as db:
                await upsert_match_result(
                    db,
                    user_id,
                    job_id,
                    analysis_status="analyzing",
                    progress=min(tick, 92),
                )
                await db.commit()
            yield sse_match(
                {
                    "type": "job_progress",
                    "job_id": job_id,
                    "index": index + 1,
                    "total": total,
                    "progress": min(tick, 92),
                }
            )
            tick += 18
            try:
                await asyncio.wait_for(asyncio.shield(llm_task), timeout=0.45)
            except asyncio.TimeoutError:
                pass

        try:
            match = await llm_task
        except LLMServiceError as e:
            async with async_session() as db:
                await upsert_match_result(
                    db,
                    user_id,
                    job_id,
                    analysis_status="failed",
                    progress=0,
                    explanation=str(e.message),
                )
                await db.commit()
            yield sse_match(
                {
                    "type": "job_failed",
                    "job_id": job_id,
                    "message": e.message,
                }
            )
            continue
        except Exception as e:
            async with async_session() as db:
                await upsert_match_result(
                    db,
                    user_id,
                    job_id,
                    analysis_status="failed",
                    progress=0,
                    explanation=str(e),
                )
                await db.commit()
            yield sse_match({"type": "job_failed", "job_id": job_id, "message": str(e)})
            continue

        async with async_session() as db:
            job = await db.get(JobPosting, job_id)
            await upsert_match_result(
                db,
                user_id,
                job_id,
                analysis_status="completed",
                progress=100,
                overall_score=float(match.get("overall_score", 0)),
                dimension_scores=match.get("dimension_scores"),
                explanation=match.get("explanation", ""),
                report=match,
            )
            await db.commit()
            row = await get_match_result(db, user_id, job_id)
            item = match_dict_to_list_item(job, row, rule_score=None) if job else {}

        yield sse_match(
            {
                "type": "job_done",
                "job_id": job_id,
                "index": index + 1,
                "total": total,
                "progress": 100,
                "item": item,
            }
        )

    yield sse_match({"type": "batch_done", "job_ids": job_ids})


async def fetch_job_report(
    db: AsyncSession,
    user_id: int,
    job_id: int,
    api_key: str,
) -> tuple[dict[str, Any], bool]:
    """返回报告 dict 与是否来自缓存。未完成时独立触发 AI（可与批量分析并发）。"""
    job = await db.get(JobPosting, job_id)
    if not job:
        raise LLMServiceError("岗位不存在", status_code=404)  # noqa: TRY003

    row = await get_match_result(db, user_id, job_id)
    if row and row.analysis_status == "completed" and row.report:
        return report_from_match(row.report, job), True

    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    resume = await get_active_resume(db, user_id)

    if row and row.analysis_status == "analyzing":
        pass
    elif row is None:
        await upsert_match_result(db, user_id, job_id, analysis_status="analyzing", progress=5)

    match = await score_job_match(job, resume, profile, api_key=api_key, use_llm=True)
    await upsert_match_result(
        db,
        user_id,
        job_id,
        analysis_status="completed",
        progress=100,
        overall_score=float(match.get("overall_score", 0)),
        dimension_scores=match.get("dimension_scores"),
        explanation=match.get("explanation", ""),
        report=match,
    )
    await db.commit()
    return report_from_match(match, job), False


# 兼容对话里 recommend_jobs 调用
async def recommend_jobs(
    db: AsyncSession,
    user_id: int,
    profile: StudentProfile | None,
    resume: Resume | None,
    *,
    api_key: str,
    limit: int = 10,
    city: str | None = None,
    job_type: str | None = None,
) -> list[dict[str, Any]]:
    ranked = await rank_jobs_for_recommend(db, profile, city=city, job_type=job_type, limit=limit)
    items: list[dict[str, Any]] = []
    for job, _ in ranked[:limit]:
        row = await get_match_result(db, user_id, job.id)
        match: dict[str, Any] = {}
        if row and row.analysis_status == "completed" and row.report:
            match = row.report
            score = float(row.overall_score or match.get("overall_score", 0))
            expl = row.explanation or match.get("explanation", "")
        else:
            match = await score_job_match(job, resume, profile, api_key=api_key, use_llm=bool(resume))
            score = float(match.get("overall_score", 0))
            expl = match.get("explanation", "")
        items.append(
            {
                "job_id": job.id,
                "company": job.company,
                "title": job.title,
                "city": job.city,
                "overall_score": score,
                "dimension_scores": match.get("dimension_scores"),
                "explanation": expl,
                "recommendation": match.get("recommendation", "try"),
                "_full": match,
            }
        )
    return items
