import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.client import structured_completion
from app.models.job import JobPosting
from app.models.resume import Resume
from app.services.matching import score_job_match

OPTIMIZE_PROMPT = """你是简历优化教练。针对目标岗位优化简历表述，严禁编造不存在的经历、公司、项目。
输出 JSON：
{
  "before_score": 0-100,
  "summary": "优化策略概述",
  "suggestions": [{"priority": "P0|P1|P2", "area": "", "issue": "", "action": ""}],
  "rewritten_sections": [{"section": "experience|projects|skills", "original": "", "suggested": ""}]
}
只输出 JSON。"""


async def optimize_resume_for_job(
    db: AsyncSession,
    resume: Resume,
    job: JobPosting,
    *,
    api_key: str,
) -> dict[str, Any]:
    match = await score_job_match(job, resume, None, api_key=api_key, use_llm=True)
    before = float(match.get("overall_score", 0))

    resume_json = json.dumps(resume.structured or {"raw": resume.raw_text}, ensure_ascii=False)[:10000]
    job_text = f"{job.title} @ {job.company}\n{job.description}"

    data = await structured_completion(
        OPTIMIZE_PROMPT + "\n当前匹配分约：" + str(before),
        f"简历：\n{resume_json}\n\n目标岗位：\n{job_text}",
        api_key=api_key,
    )
    if not isinstance(data, dict):
        data = {
            "before_score": before,
            "summary": "请稍后重试或检查 API 配置",
            "suggestions": [],
            "rewritten_sections": [],
        }
    data.setdefault("before_score", before)
    return data
