import { Check, FileText, KeyRound, MessageSquarePlus, PanelLeft, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ChatSession, ResumeListItem, ResumeListResponse } from "../api/types";

interface Props {
  open: boolean;
  sessions: ChatSession[];
  currentId: number | null;
  resumeVersion: number;
  onToggle: () => void;
  onNew: () => void;
  onSelect: (id: number) => void;
  onResumeChange?: () => void;
}

function formatResumeDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  } catch {
    return "";
  }
}

export default function Sidebar({
  open,
  sessions,
  currentId,
  resumeVersion,
  onToggle,
  onNew,
  onSelect,
  onResumeChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [serverFallback, setServerFallback] = useState(false);
  const [keyMsg, setKeyMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<number | null>(null);
  const [resumeMsg, setResumeMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  const loadKeyStatus = useCallback(async () => {
    try {
      const s = await api<{ configured: boolean; masked: string | null; using_server_fallback: boolean }>(
        "/api/v1/settings/api-key"
      );
      setConfigured(s.configured);
      setMasked(s.masked);
      setServerFallback(s.using_server_fallback);
    } catch {
      /* ignore */
    }
  }, []);

  const loadResumes = useCallback(async () => {
    try {
      const data = await api<ResumeListResponse>("/api/v1/resumes");
      setResumes(data.items);
      setActiveResumeId(data.active_id);
    } catch {
      setResumes([]);
      setActiveResumeId(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadKeyStatus();
      loadResumes();
    }
  }, [open, loadKeyStatus, loadResumes, resumeVersion]);

  useEffect(() => {
    if (!keyMsg) return;
    const t = setTimeout(() => setKeyMsg(""), 3500);
    return () => clearTimeout(t);
  }, [keyMsg]);

  useEffect(() => {
    if (!resumeMsg) return;
    const t = setTimeout(() => setResumeMsg(""), 3500);
    return () => clearTimeout(t);
  }, [resumeMsg]);

  const saveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    setKeyMsg("");
    try {
      const res = await api<{ masked: string }>("/api/v1/settings/api-key", {
        method: "PUT",
        body: JSON.stringify({ api_key: apiKeyInput.trim() }),
      });
      setMasked(res.masked);
      setConfigured(true);
      setServerFallback(false);
      setApiKeyInput("");
      setKeyMsg("已保存（加密存储）");
    } catch (err) {
      setKeyMsg(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    await api("/api/v1/settings/api-key", { method: "DELETE" });
    setApiKeyInput("");
    setKeyMsg("已清除个人 Key");
    await loadKeyStatus();
  };

  const uploadResume = async (file: File) => {
    setUploading(true);
    setResumeMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api("/api/v1/resumes/upload", { method: "POST", body: fd });
      setResumeMsg("已上传并设为当前简历");
      await loadResumes();
      onResumeChange?.();
    } catch (err) {
      setResumeMsg(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const activateResume = async (id: number) => {
    if (id === activeResumeId) return;
    setActivatingId(id);
    setResumeMsg("");
    try {
      await api(`/api/v1/resumes/${id}/activate`, { method: "PATCH" });
      setActiveResumeId(id);
      setResumeMsg("已切换当前简历，后续对话将使用新简历");
      await loadResumes();
      onResumeChange?.();
    } catch (err) {
      setResumeMsg(err instanceof Error ? err.message : "切换失败");
    } finally {
      setActivatingId(null);
    }
  };

  if (!open) return null;

  return (
    <aside className="chat-enter w-72 shrink-0 border-r border-gray-100 bg-gray-50/80 flex flex-col h-full min-h-0">
      <div className="chat-enter p-3 flex items-center gap-2 shrink-0">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
          title="收起边栏"
        >
          <PanelLeft size={18} />
        </button>
        <button
          onClick={onNew}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50"
        >
          <MessageSquarePlus size={16} />
          新对话
        </button>
      </div>

      <div className="chat-enter mx-3 mb-3 p-3 rounded-xl border border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <KeyRound size={16} className="text-brand-600" />
          DeepSeek API Key
        </div>
        <p className="text-xs text-gray-500 mb-2">填写 Key 后可用 AI 解析简历与对话。</p>
        {configured && masked && (
          <p className="text-xs text-green-700 mb-2">
            当前：{masked}
            {serverFallback && "（服务端默认）"}
          </p>
        )}
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="sk-..."
          className="w-full text-xs rounded-lg border px-2 py-1.5 mb-2"
        />
        <div className="flex gap-2">
          <button
            onClick={saveKey}
            disabled={saving || !apiKeyInput.trim()}
            className="flex-1 text-xs py-1.5 rounded-lg bg-brand-600 text-white disabled:opacity-50"
          >
            {saving ? "保存中" : "保存"}
          </button>
          <button
            onClick={clearKey}
            className="text-xs py-1.5 px-2 rounded-lg border text-gray-600 hover:bg-gray-50"
          >
            清除
          </button>
        </div>
        {keyMsg && <p className="text-xs mt-1 text-brand-700">{keyMsg}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2">
        {sessions.length === 0 && (
          <p className="text-xs text-gray-400 px-2 py-2">暂无历史对话</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 truncate ${
              currentId === s.id ? "bg-white shadow-sm border border-gray-100" : "hover:bg-gray-100"
            }`}
          >
            {s.title || "新对话"}
          </button>
        ))}
      </div>

      <div className="chat-enter shrink-0 mx-3 mb-2 p-3 rounded-xl border border-gray-200 bg-white max-h-[38vh] flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileText size={16} className="text-brand-600" />
            我的简历
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 disabled:opacity-50"
          >
            <Upload size={14} />
            {uploading ? "解析中" : "上传"}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadResume(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mb-2 shrink-0">
          对话与匹配均使用「当前」简历；点击列表可切换。
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {resumes.length === 0 && (
            <p className="text-xs text-gray-400 py-2">暂无简历，请上传 PDF / Word / TXT</p>
          )}
          {resumes.map((r) => {
            const active = r.id === activeResumeId || r.is_active;
            return (
              <button
                key={r.id}
                type="button"
                disabled={activatingId === r.id}
                onClick={() => activateResume(r.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border text-xs transition ${
                  active
                    ? "border-brand-200 bg-brand-50/80"
                    : "border-transparent hover:bg-gray-50 hover:border-gray-100"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {active ? (
                    <Check size={14} className="text-brand-600 shrink-0 mt-0.5" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate" title={r.filename}>
                      {r.filename}
                    </div>
                    <div className="text-gray-500 truncate mt-0.5">{r.preview || "已解析"}</div>
                    <div className="text-gray-400 mt-0.5">
                      v{r.version} · {formatResumeDate(r.created_at)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {resumeMsg && <p className="text-xs mt-2 text-brand-700 shrink-0">{resumeMsg}</p>}
      </div>

      <div className="p-3 text-xs text-gray-400 border-t border-gray-100 shrink-0">Offer 捕手 v1.1</div>
    </aside>
  );
}
