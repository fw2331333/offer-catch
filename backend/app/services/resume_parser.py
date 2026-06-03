import os
from pathlib import Path

import pdfplumber
from docx import Document

from app.llm.client import structured_completion

STRUCTURE_PROMPT = """你是简历解析专家。将简历纯文本解析为 JSON，严格遵循以下结构，不要编造不存在的内容：
{
  "basics": {"name": "", "email": "", "phone": ""},
  "education": [{"school": "", "degree": "", "major": "", "start": "", "end": ""}],
  "experience": [{"company": "", "role": "", "bullets": []}],
  "projects": [{"name": "", "tech_stack": [], "bullets": []}],
  "skills": {"hard": [], "soft": []},
  "certificates": []
}
只输出 JSON，无其他文字。"""


def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        parts: list[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
        return "\n".join(parts)
    if suffix in (".docx", ".doc"):
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    raise ValueError(f"不支持的文件格式: {suffix}")


async def parse_resume_file(file_path: str, *, api_key: str) -> tuple[str, dict]:
    raw_text = extract_text_from_file(file_path)
    if not raw_text.strip():
        raw_text = "（未能提取文本，请检查文件是否为扫描件）"
    structured = await structured_completion(
        STRUCTURE_PROMPT,
        f"简历文本：\n{raw_text[:12000]}",
        api_key=api_key,
    )
    if not isinstance(structured, dict):
        structured = {
            "basics": {},
            "education": [],
            "experience": [],
            "projects": [],
            "skills": {"hard": [], "soft": []},
            "certificates": [],
            "raw_fallback": raw_text[:5000],
        }
    return raw_text, structured


def ensure_upload_dir(upload_dir: str) -> None:
    os.makedirs(upload_dir, exist_ok=True)
