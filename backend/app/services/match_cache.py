"""岗位匹配结果缓存（match_results 表）。"""

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import JobPosting
from app.models.match import MatchResult


async def clear_user_match_results(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(MatchResult).where(MatchResult.user_id == user_id))


async def get_match_result(db: AsyncSession, user_id: int, job_id: int) -> MatchResult | None:
    result = await db.execute(
        select(MatchResult).where(MatchResult.user_id == user_id, MatchResult.job_id == job_id)
    )
    return result.scalar_one_or_none()


async def upsert_match_result(
    db: AsyncSession,
    user_id: int,
    job_id: int,
    *,
    analysis_status: str,
    progress: int = 0,
    overall_score: float | None = None,
    dimension_scores: dict | None = None,
    explanation: str | None = None,
    report: dict | None = None,
) -> MatchResult:
    row = await get_match_result(db, user_id, job_id)
    if row is None:
        row = MatchResult(
            user_id=user_id,
            job_id=job_id,
            analysis_status=analysis_status,
            progress=progress,
            overall_score=overall_score,
            dimension_scores=dimension_scores,
            explanation=explanation,
            report=report,
        )
        db.add(row)
    else:
        row.analysis_status = analysis_status
        row.progress = progress
        if overall_score is not None:
            row.overall_score = overall_score
        if dimension_scores is not None:
            row.dimension_scores = dimension_scores
        if explanation is not None:
            row.explanation = explanation
        if report is not None:
            row.report = report
    await db.flush()
    return row


def match_dict_to_list_item(job: JobPosting, row: MatchResult | None, *, rule_score: float | None) -> dict[str, Any]:
    if row is None:
        return {
            "job_id": job.id,
            "company": job.company,
            "title": job.title,
            "city": job.city,
            "analysis_status": "pending",
            "progress": 0,
            "overall_score": None,
            "dimension_scores": None,
            "explanation": "",
            "recommendation": "",
            "rule_score": rule_score,
        }
    return {
        "job_id": job.id,
        "company": job.company,
        "title": job.title,
        "city": job.city,
        "analysis_status": row.analysis_status,
        "progress": row.progress,
        "overall_score": row.overall_score,
        "dimension_scores": row.dimension_scores,
        "explanation": row.explanation or "",
        "recommendation": (row.report or {}).get("recommendation", ""),
        "rule_score": rule_score,
    }


def report_from_match(match: dict[str, Any], job: JobPosting) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "company": job.company,
        "title": job.title,
        "overall_score": float(match.get("overall_score", 0)),
        "matched_items": match.get("matched_items") or [],
        "gaps": match.get("gaps") or [],
        "risks": match.get("risks") or [],
        "recommendation": match.get("recommendation", "try"),
        "summary": match.get("summary", match.get("explanation", "")),
    }
