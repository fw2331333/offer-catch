"""从结构化简历提取列表预览与上下文摘要。"""


def resume_preview(structured: dict | None) -> str:
    if not structured:
        return "已上传"
    skills = (structured.get("skills") or {}).get("hard") or []
    if skills:
        return "技能：" + "、".join(str(s) for s in skills[:6])
    exp = structured.get("experience") or []
    if exp and isinstance(exp[0], dict):
        role = exp[0].get("role") or ""
        company = exp[0].get("company") or ""
        if role or company:
            return f"{role} @ {company}".strip(" @")
    basics = structured.get("basics") or {}
    name = basics.get("name") if isinstance(basics, dict) else None
    return str(name) if name else "已解析"
