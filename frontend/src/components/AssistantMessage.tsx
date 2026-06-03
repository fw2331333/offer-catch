import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import MarkdownMessage from "./MarkdownMessage";
import { parseThinkingContent } from "../utils/parseThinking";

interface Props {
  content: string;
  streaming?: boolean;
  streamThinking?: string;
  streamContent?: string;
  statusText?: string;
}

export default function AssistantMessage({
  content,
  streaming = false,
  streamThinking = "",
  streamContent = "",
  statusText,
}: Props) {
  const [thinkOpen, setThinkOpen] = useState(true);
  const parsed = parseThinkingContent(content);
  const thinking = streaming ? streamThinking : parsed.thinking;
  const answer = streaming ? streamContent : parsed.answer;

  return (
    <div className="space-y-3">
      {streaming && statusText && !thinking && !answer && (
        <p className="text-xs text-gray-400 animate-pulse">{statusText}</p>
      )}
      {thinking ? (
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 overflow-hidden">
          <button
            type="button"
            onClick={() => setThinkOpen(!thinkOpen)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100/80"
          >
            {thinkOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            分析要点
            {streaming && <span className="ml-1 animate-pulse">…</span>}
          </button>
          {thinkOpen && (
            <div className="px-3.5 pb-3.5 text-[15px] leading-[1.65] text-slate-700 whitespace-pre-wrap border-t border-slate-200/80">
              {thinking}
            </div>
          )}
        </div>
      ) : null}
      {(answer || streaming) && (
        <MarkdownMessage content={answer || (streaming ? "▍" : "")} />
      )}
    </div>
  );
}
