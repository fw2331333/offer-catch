import json
import re
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.client import structured_completion
from app.models.job import JobPosting
from app.models.user import StudentProfile

AI_SEARCH_PROMPT = """你是校招求职搜索助手。根据用户搜索意图生成可能适合的实习/校招岗位。
要求：
1. 必须严格遵守用户给出的「硬性筛选条件」（城市、类型等），不得擅自改成其他城市
2. 公司名应为真实知名企业或合理雇主
3. 不得虚构具体招聘链接；description 写典型 JD 要点即可
4. 每条必须包含 relevance_reason
5. verify_note 提醒用户到官网/BOSS/智联等核实

输出 JSON：
{
  "search_summary": "本次搜索思路，须体现实际使用的城市与方向",
  "jobs": [{
    "company": "",
    "title": "",
    "city": "",
    "job_type": "实习或校招",
    "salary_min": null,
    "salary_max": null,
    "industry": "",
    "description": "职责与要求摘要，80-200字",
    "requirements": {"required_skills": [], "preferred_skills": [], "education": ""},
    "tags": [],
    "relevance_reason": "",
    "verify_note": "请到官网核实",
    "source_url": null
  }]
}
只输出 JSON。source_url 必须是真实 https 链接或 null。"""

PARSE_QUERY_PROMPT = """从用户求职搜索语句中提取结构化筛选条件，输出 JSON：
{"keywords": ["词1","词2"], "city": "城市名或null", "job_type": "实习|校招|null", "industry": "行业或null"}
城市请输出标准简称（如 重庆、北京、上海）。只输出 JSON。"""

# 规则抽取城市（避免仅搜「实习」时丢失城市）
CITY_ALIASES: dict[str, str] = {
    "北京": "北京",
    "上海": "上海",
    "广州": "广州",
    "深圳": "深圳",
    "杭州": "杭州",
    "南京": "南京",
    "苏州": "苏州",
    "成都": "成都",
    "武汉": "武汉",
    "西安": "西安",
    "重庆": "重庆",
    "天津": "天津",
    "长沙": "长沙",
    "郑州": "郑州",
    "青岛": "青岛",
    "厦门": "厦门",
    "福州": "福州",
    "合肥": "合肥",
    "济南": "济南",
    "大连": "大连",
    "沈阳": "沈阳",
    "哈尔滨": "哈尔滨",
    "昆明": "昆明",
    "南宁": "南宁",
    "海口": "海口",
    "石家庄": "石家庄",
    "太原": "太原",
    "南昌": "南昌",
    "贵阳": "贵阳",
    "兰州": "兰州",
    "乌鲁木齐": "乌鲁木齐",
    "呼和浩特": "呼和浩特",
    "宁波": "宁波",
    "无锡": "无锡",
    "珠海": "珠海",
    "佛山": "佛山",
    "东莞": "东莞",
}


def _req_dict(req: Any) -> dict | None:
    if req is None:
        return None
    if hasattr(req, "model_dump"):
        return req.model_dump()
    return req if isinstance(req, dict) else None


def _fallback_parse_query(query: str) -> dict[str, Any]:
    city = extract_city_from_text(query)
    job_type = None
    if "实习" in query:
        job_type = "实习"
    elif "校招" in query:
        job_type = "校招"
    keywords = [w for w in re.split(r"\s+", query.strip()) if w and w not in (city or "")]
    if job_type:
        keywords = [k for k in keywords if k != job_type]
    return {"keywords": keywords, "city": city, "job_type": job_type, "industry": None}


def extract_city_from_text(text: str) -> str | None:
    if not text:
        return None
    for key, canonical in CITY_ALIASES.items():
        if key in text:
            return canonical
    return None


async def parse_search_query(query: str, *, api_key: str) -> dict[str, Any]:
    try:
        data = await structured_completion(PARSE_QUERY_PROMPT, query, api_key=api_key)
        if isinstance(data, dict):
            if not data.get("city"):
                data["city"] = extract_city_from_text(query)
            return data
    except Exception:
        pass
    return _fallback_parse_query(query)


def resolve_search_filters(
    query: str,
    parsed: dict[str, Any],
    *,
    city: str | None = None,
    job_type: str | None = None,
    roles: list[str] | None = None,
) -> dict[str, Any]:
    """合并前端显式条件、LLM 解析与规则抽取，显式条件优先。"""
    p_city = parsed.get("city")
    if isinstance(p_city, str):
        p_city = p_city.strip() or None
    resolved_city = (city or "").strip() or p_city or extract_city_from_text(query)

    resolved_type = (job_type or "").strip() or parsed.get("job_type")
    if resolved_type:
        resolved_type = str(resolved_type).strip()

    keywords: list[str] = list(parsed.get("keywords") or [])
    if isinstance(keywords, str):
        keywords = [keywords]
    for r in roles or []:
        r = (r or "").strip()
        if r and r not in keywords:
            keywords.append(r)
    # 通用词不作为唯一关键词
    stop = {resolved_city, resolved_type, "实习", "校招", "招聘", "岗位"}
    keywords = [k for k in keywords if k and k not in stop]

    return {
        "city": resolved_city,
        "job_type": resolved_type,
        "industry": parsed.get("industry"),
        "keywords": keywords[:8],
    }


def _job_matches_keywords(job: JobPosting, keywords: list[str]) -> tuple[bool, str]:
    if not keywords:
        return True, "条件匹配"
    haystack = f"{job.title} {job.company} {job.description} {job.industry or ''} {' '.join(job.tags or [])}"
    matched = [k for k in keywords if k and k in haystack]
    if matched:
        return True, f"匹配：{', '.join(matched[:5])}"
    return False, ""


async def search_local_jobs(
    db: AsyncSession,
    query: str,
    *,
    api_key: str,
    limit: int = 20,
    profile: StudentProfile | None = None,
    city: str | None = None,
    job_type: str | None = None,
    roles: list[str] | None = None,
) -> list[tuple[JobPosting, str]]:
    parsed = await parse_search_query(query, api_key=api_key)
    filters = resolve_search_filters(query, parsed, city=city, job_type=job_type, roles=roles)
    keywords: list[str] = filters["keywords"]
    city_f = filters["city"]
    job_type_f = filters["job_type"]
    industry = filters["industry"]

    stmt = select(JobPosting)
    conditions = []
    if city_f:
        conditions.append(JobPosting.city.ilike(f"%{city_f}%"))
    if job_type_f:
        conditions.append(JobPosting.job_type == job_type_f)
    if industry:
        conditions.append(JobPosting.industry.ilike(f"%{industry}%"))
    if keywords:
        kw_conds = []
        for k in keywords[:6]:
            pat = f"%{k}%"
            kw_conds.append(
                or_(
                    JobPosting.title.ilike(pat),
                    JobPosting.company.ilike(pat),
                    JobPosting.description.ilike(pat),
                )
            )
        if kw_conds:
            conditions.append(or_(*kw_conds))
    if conditions:
        from sqlalchemy import and_

        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt.limit(50))
    jobs = list(result.scalars().all())

    has_strict_filter = bool(city_f or job_type_f or industry)
    if not jobs and not has_strict_filter:
        broad = select(JobPosting).where(
            or_(
                JobPosting.title.ilike(f"%{query[:20]}%"),
                JobPosting.description.ilike(f"%{query[:30]}%"),
                JobPosting.company.ilike(f"%{query[:20]}%"),
            )
        )
        result = await db.execute(broad.limit(30))
        jobs = list(result.scalars().all())

    scored: list[tuple[JobPosting, str, float]] = []
    for job in jobs:
        if city_f and city_f not in job.city:
            continue
        ok, reason = _job_matches_keywords(job, keywords)
        if not ok and keywords:
            continue
        if not reason:
            parts = []
            if city_f and city_f in job.city:
                parts.append(city_f)
            if job_type_f:
                parts.append(job_type_f)
            reason = " · ".join(parts) if parts else "岗位库匹配"

        score = 0.0
        if city_f and city_f in job.city:
            score += 3
        if profile and profile.target_roles and any(r in job.title for r in profile.target_roles):
            score += 1
        scored.append((job, reason, score))

    scored.sort(key=lambda x: x[2], reverse=True)
    return [(j, r) for j, r, _ in scored[:limit]]


async def discover_jobs_with_ai(
    query: str,
    profile: StudentProfile | None,
    *,
    api_key: str,
    limit: int = 8,
    city: str | None = None,
    job_type: str | None = None,
    roles: list[str] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    parsed = await parse_search_query(query, api_key=api_key)
    filters = resolve_search_filters(query, parsed, city=city, job_type=job_type, roles=roles)
    city_f = filters["city"]
    job_type_f = filters["job_type"] or "实习"
    roles_f = roles or filters["keywords"]

    hard_lines = [f"用户搜索语句：{query}"]
    if city_f:
        hard_lines.append(f"硬性条件：所有岗位 city 字段必须为「{city_f}」，禁止输出其他城市岗位。")
    if job_type_f:
        hard_lines.append(f"硬性条件：job_type 必须为「{job_type_f}」。")
    if roles_f:
        hard_lines.append(f"岗位方向关键词：{', '.join(roles_f)}")
    hard_lines.append(f"请生成 {limit} 条岗位。")
    if profile:
        hard_lines.append(
            "学生画像仅供参考，不得用画像中的城市覆盖上述硬性城市条件："
            + json.dumps(
                {
                    "target_cities": profile.target_cities,
                    "target_roles": profile.target_roles,
                },
                ensure_ascii=False,
            )
        )

    user_msg = "\n".join(hard_lines)
    data = await structured_completion(AI_SEARCH_PROMPT, user_msg, api_key=api_key)
    if not isinstance(data, dict):
        return "AI 暂未返回结果，请稍后重试", []
    summary = str(data.get("search_summary", ""))
    jobs = data.get("jobs") or []
    if not isinstance(jobs, list):
        jobs = []
    normalized: list[dict[str, Any]] = []
    for item in jobs[:limit]:
        if not isinstance(item, dict):
            continue
        if not item.get("company") or not item.get("title"):
            continue
        if city_f:
            item_city = str(item.get("city") or "")
            if city_f not in item_city:
                item = {**item, "city": city_f}
        url = item.get("source_url")
        if url and not (isinstance(url, str) and url.startswith(("http://", "https://"))):
            item = {**item, "source_url": None}
        item.setdefault("city", city_f or "未知")
        item.setdefault("job_type", job_type_f)
        item.setdefault("description", item.get("description") or "详见招聘页面")
        normalized.append(item)

    if city_f and not summary:
        summary = f"已按「{city_f}」生成推荐岗位。"
    return summary, normalized


def job_from_create_data(data: dict[str, Any], *, source: str, user_id: int | None) -> JobPosting:
    allowed = {
        "company",
        "title",
        "city",
        "job_type",
        "salary_min",
        "salary_max",
        "industry",
        "description",
        "requirements",
        "tags",
        "source_url",
    }
    filtered = {k: data[k] for k in allowed if k in data}
    req = _req_dict(filtered.get("requirements"))
    tags = filtered.get("tags") or []
    return JobPosting(
        company=filtered["company"],
        title=filtered["title"],
        city=filtered["city"],
        job_type=filtered.get("job_type") or "实习",
        salary_min=filtered.get("salary_min"),
        salary_max=filtered.get("salary_max"),
        industry=filtered.get("industry"),
        description=filtered["description"],
        requirements=req,
        tags=tags,
        source=source,
        source_url=filtered.get("source_url"),
        created_by_user_id=user_id,
    )
