import { getToken, clearToken } from "./client";
import type { MatchListItem } from "./types";

export type MatchAnalyzeEvent =
  | { type: "job_start"; job_id: number; index: number; total: number; progress: number }
  | { type: "job_progress"; job_id: number; index: number; total: number; progress: number }
  | {
      type: "job_done";
      job_id: number;
      index: number;
      total: number;
      progress: number;
      item: MatchListItem;
      cached?: boolean;
    }
  | { type: "job_failed"; job_id: number; message: string }
  | { type: "batch_done"; job_ids: number[] };

export async function streamAnalyzeBatch(
  jobIds: number[],
  onEvent: (event: MatchAnalyzeEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/v1/match/analyze-batch", {
    method: "POST",
    headers,
    body: JSON.stringify({ job_ids: jobIds }),
    signal,
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
      throw new Error(data.detail || "分析失败");
    } catch {
      throw new Error(text || `分析失败 (${res.status})`);
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
        onEvent(JSON.parse(jsonStr) as MatchAnalyzeEvent);
      } catch {
        /* skip */
      }
    }
  }
}
