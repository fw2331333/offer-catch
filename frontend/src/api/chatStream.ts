import { getToken, clearToken } from "./client";

export type ChatStreamEvent =
  | { type: "session"; session_id: number }
  | { type: "status"; message: string }
  | { type: "thinking"; delta: string }
  | { type: "content"; delta: string }
  | { type: "done"; session_id: number; thinking: string; content: string }
  | { type: "error"; message: string };

export interface ChatStreamBody {
  message: string;
  session_id: number | null;
  mode?: string;
  deep_think: boolean;
  smart_search: boolean;
}

export async function streamChat(
  body: ChatStreamBody,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/v1/chat/send/stream", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("未登录");
  }

  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.detail || "请求失败");
    } catch {
      throw new Error(text || `请求失败 (${res.status})`);
    }
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("浏览器不支持流式响应");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr) as ChatStreamEvent);
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}
