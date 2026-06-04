import { ArrowUp, Brain, Briefcase, LogOut, Menu, Paperclip, Sparkles, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useEntranceAnimation } from "../hooks/useEntranceAnimation";
import { streamChat } from "../api/chatStream";
import { api, clearToken } from "../api/client";
import type { ChatMessage, ChatSession } from "../api/types";
import AssistantMessage from "../components/AssistantMessage";
import PretextUserBubble from "../components/PretextUserBubble";
import Sidebar from "../components/Sidebar";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { formatStoredMessage } from "../utils/parseThinking";

const MAIN_NAV = [
  { to: "/jobs", label: "岗位库", icon: Briefcase },
  { to: "/match", label: "岗位库匹配", icon: Sparkles },
  { to: "/profile", label: "求职意向", icon: User },
] as const;

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [deepThink, setDeepThink] = useState(false);
  const [smartSearch, setSmartSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resumeVersion, setResumeVersion] = useState(0);
  const [streamThinking, setStreamThinking] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamStatus, setStreamStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const threadWidth = useContainerWidth(threadRef, 680);

  useEntranceAnimation(pageRef, [], {
    selector: ".chat-enter",
    y: 16,
    stagger: 0.06,
    duration: 0.45,
  });

  const loadSessions = useCallback(async () => {
    const list = await api<ChatSession[]>("/api/v1/chat/sessions");
    setSessions(list);
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    const msgs = await api<ChatMessage[]>(`/api/v1/chat/sessions/${id}/messages`);
    setMessages(msgs);
  }, []);

  useEffect(() => {
    loadSessions().catch(console.error);
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamThinking, streamContent]);

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setStreamThinking("");
    setStreamContent("");
  };

  const selectSession = async (id: number) => {
    setSessionId(id);
    await loadMessages(id);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setStreamThinking("");
    setStreamContent("");
    setStreamStatus("");

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantId = Date.now() + 1;
    setMessages((m) => [...m, userMsg]);

    try {
      let finalSessionId = sessionId;
      await streamChat(
        {
          message: text,
          session_id: sessionId,
          mode: "fast",
          deep_think: deepThink,
          smart_search: smartSearch,
        },
        (ev) => {
          if (ev.type === "session") {
            finalSessionId = ev.session_id;
            setSessionId(ev.session_id);
          } else if (ev.type === "status") {
            setStreamStatus(ev.message);
          } else if (ev.type === "thinking") {
            setStreamThinking((t) => t + ev.delta);
          } else if (ev.type === "content") {
            setStreamContent((c) => c + ev.delta);
          } else if (ev.type === "done") {
            finalSessionId = ev.session_id;
            const stored = formatStoredMessage(ev.thinking, ev.content);
            setMessages((m) => [
              ...m,
              {
                id: assistantId,
                role: "assistant",
                content: stored,
                created_at: new Date().toISOString(),
              },
            ]);
            setStreamThinking("");
            setStreamContent("");
            setStreamStatus("");
          } else if (ev.type === "error") {
            setMessages((m) => [
              ...m,
              {
                id: assistantId,
                role: "assistant",
                content: ev.message,
                created_at: new Date().toISOString(),
              },
            ]);
            setStreamThinking("");
            setStreamContent("");
          }
        }
      );
      if (finalSessionId) setSessionId(finalSessionId);
      await loadSessions();
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: assistantId,
          role: "assistant",
          content: err instanceof Error ? err.message : "发送失败",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setStreamThinking("");
      setStreamContent("");
      setStreamStatus("");
    }
  };

  const bumpResume = () => setResumeVersion((v) => v + 1);

  const hasMessages = messages.length > 0;

  return (
    <div ref={pageRef} className="h-screen flex bg-white">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        currentId={sessionId}
        resumeVersion={resumeVersion}
        onToggle={() => setSidebarOpen(false)}
        onNew={newChat}
        onSelect={selectSession}
        onResumeChange={bumpResume}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="chat-enter shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="打开边栏"
            >
              <Menu size={18} />
            </button>
          )}
          <div className="flex-1 font-medium text-gray-800">Offer 捕手</div>
          <button
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="退出"
          >
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {!hasMessages && !loading ? (
            <div className="max-w-3xl mx-auto px-4 pt-[10vh] flex flex-col items-center">
              <div className="chat-enter w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg shadow-brand-100">
                O
              </div>
              <h2 className="chat-enter text-2xl font-medium text-gray-800 mb-2">开始你的求职之旅</h2>
              <p className="chat-enter text-sm text-gray-500 mb-8">
                左侧上传简历 · 深度思考展示分析要点
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {MAIN_NAV.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="chat-enter flex items-center gap-2 px-5 py-3 rounded-full bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-700 text-sm font-medium transition border border-transparent hover:border-brand-200"
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div ref={threadRef} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <PretextUserBubble text={msg.content} containerWidth={threadWidth} />
                  ) : (
                    <div className="max-w-[85%] min-w-0 rounded-2xl px-4 py-3 bg-gray-50 text-gray-800 border border-gray-100 shadow-sm">
                      <AssistantMessage content={msg.content} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-50 border border-gray-100">
                    <AssistantMessage
                      content=""
                      streaming
                      streamThinking={streamThinking}
                      streamContent={streamContent}
                      statusText={streamStatus || "正在连接 AI…"}
                    />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        <div className="chat-enter shrink-0 border-t border-gray-100 bg-white pb-6 pt-2">
          <div className="max-w-3xl mx-auto px-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="给 Offer 捕手 发送消息 — 流式输出"
                rows={3}
                className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] focus:outline-none"
                disabled={loading}
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeepThink(!deepThink)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition ${
                      deepThink
                        ? "bg-brand-50 border-brand-200 text-brand-700"
                        : "border-gray-200 text-gray-500 hover:bg-white"
                    }`}
                  >
                    <Brain size={14} />
                    深度思考
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmartSearch(!smartSearch)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition ${
                      smartSearch
                        ? "bg-brand-50 border-brand-200 text-brand-700"
                        : "border-gray-200 text-gray-500 hover:bg-white"
                    }`}
                  >
                    <Sparkles size={14} />
                    岗位库匹配
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"
                    title="在左侧「我的简历」上传或切换"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="p-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              AI 依据左侧「当前简历」作答 · 岗位库无匹配时会如实说明
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
