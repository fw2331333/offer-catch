const THINK_OPEN = "[[[THINK]]]";
const THINK_CLOSE = "[[[/THINK]]]";

export function parseThinkingContent(raw: string): { thinking: string; answer: string } {
  const text = raw || "";
  const start = text.indexOf(THINK_OPEN);
  const end = text.indexOf(THINK_CLOSE);
  if (start !== -1 && end !== -1 && end > start) {
    return {
      thinking: text.slice(start + THINK_OPEN.length, end).trim(),
      answer: text.slice(end + THINK_CLOSE.length).trim(),
    };
  }
  return { thinking: "", answer: text };
}

export function formatStoredMessage(thinking: string, content: string): string {
  const t = thinking.trim();
  const c = content.trim();
  if (t) return `${THINK_OPEN}\n${t}\n${THINK_CLOSE}\n\n${c}`;
  return c;
}
