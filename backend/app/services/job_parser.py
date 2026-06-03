from io import BytesIO
from typing import Any

from app.llm.client import structured_completion
from app.services.resume_parser import extract_text_from_file

PARSE_JD_PROMPT = """你是招聘信息解析专家。从用户提供的岗位截图 OCR 文本或粘贴的 JD 原文中，提取结构化信息。
若字段无法从原文推断，用合理默认值：city 填「未知」、job_type 填「实习」。
不要编造原文中不存在的硬性要求，技能仅从原文提取。

输出 JSON：
{
  "company": "",
  "title": "",
  "city": "",
  "job_type": "实习或校招",
  "salary_min": null,
  "salary_max": null,
  "industry": null,
  "description": "完整职责与要求摘要，尽量保留原文要点",
  "requirements": {"required_skills": [], "preferred_skills": [], "education": ""},
  "tags": [],
  "parse_note": "解析说明：哪些字段来自原文、哪些为推断"
}
只输出 JSON。"""


async def parse_job_file(file_path: str, *, api_key: str) -> tuple[str, dict[str, Any]]:
    raw_text = extract_text_from_file(file_path)
    parsed = await parse_jd_text(raw_text, api_key=api_key)
    return raw_text, parsed


async def parse_jd_text(raw_text: str, *, api_key: str) -> dict[str, Any]:
    text = raw_text.strip()
    if len(text) < 20:
        raise ValueError("内容过短，请粘贴完整岗位描述或上传更清晰的截图")
    data = await structured_completion(
        PARSE_JD_PROMPT,
        f"岗位原文（可能含 OCR 噪声）：\n{text[:15000]}",
        api_key=api_key,
    )
    if not isinstance(data, dict):
        raise ValueError("AI 未能解析岗位信息，请检查内容后重试")
    if not data.get("company") or not data.get("title"):
        raise ValueError("未能识别公司或岗位名称，请补充后重试")
    data.setdefault("city", "未知")
    data.setdefault("job_type", "实习")
    data.setdefault("description", text[:3000])
    data.setdefault("tags", [])
    data.setdefault("requirements", {"required_skills": [], "preferred_skills": [], "education": ""})
    return data


def extract_text_from_image(file_bytes: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as e:
        raise ValueError("图片识别组件未安装") from e

    image = Image.open(BytesIO(file_bytes))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    # 中英文混合招聘截图
    text = pytesseract.image_to_string(image, lang="chi_sim+eng")
    text = text.strip()
    if len(text) < 15:
        raise ValueError("截图文字识别较少，请换更清晰的图片或直接粘贴岗位文字")
    return text
