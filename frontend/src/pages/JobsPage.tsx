import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Heart,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Database,
  FileUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import FlashBanner from "../components/FlashBanner";
import ResumeAnalysisPanel, { type ResumeAnalysisData } from "../components/ResumeAnalysisPanel";
import SingleAutocomplete from "../components/SingleAutocomplete";
import TagAutocomplete from "../components/TagAutocomplete";
import { useFlashMessage } from "../hooks/useFlashMessage";
import { EDUCATION_LEVELS, JOB_TYPES } from "../data/suggestions";
import { useJobSuggestions } from "../hooks/useJobSuggestions";
import type { JobDetail, JobListItem } from "../api/types";

type Tab = "library" | "favorite" | "create" | "ai";

interface ParsedPreview {
  company: string;
  title: string;
  city: string;
  job_type: string;
  description: string;
  industry?: string;
  parse_note?: string;
  tags?: string[];
}

interface AiJob {
  company: string;
  title: string;
  city: string;
  job_type: string;
  salary_min?: number;
  salary_max?: number;
  industry?: string;
  description: string;
  requirements?: {
    required_skills?: string[];
    preferred_skills?: string[];
    education?: string;
  };
  tags?: string[];
  relevance_reason?: string;
  verify_note?: string;
  source_url?: string | null;
}

interface LocalHit extends JobListItem {
  match_reason?: string;
}

const emptyForm = {
  company: "",
  title: "",
  city: "",
  job_type: "实习",
  salary_min: "",
  salary_max: "",
  industry: "",
  description: "",
  education: "本科及以上",
};

const emptyTags: string[] = [];

function composeAiSearchQuery(city: string, roles: string[], jobType: string): string {
  return [city.trim(), ...roles, jobType.trim()].filter(Boolean).join(" ");
}

export default function JobsPage() {
  const { cityOptions, roleOptions, industryOptions, skillOptions, refreshFromJobs } =
    useJobSuggestions();
  const [tab, setTab] = useState<Tab>("library");
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formTags, setFormTags] = useState<string[]>(emptyTags);
  const [formSkills, setFormSkills] = useState<string[]>(emptyTags);
  const [aiCity, setAiCity] = useState("");
  const [aiRoles, setAiRoles] = useState<string[]>([]);
  const [aiJobType, setAiJobType] = useState("实习");
  const [loading, setLoading] = useState(false);
  const { message, tone, showMessage, clearMessage } = useFlashMessage();

  const changeTab = (next: Tab) => {
    clearMessage();
    setTab(next);
  };

  const [aiQuery, setAiQuery] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [localHits, setLocalHits] = useState<LocalHit[]>([]);
  const [aiJobs, setAiJobs] = useState<AiJob[]>([]);
  const [selectedAi, setSelectedAi] = useState<Set<number>>(new Set());
  const [expandedAi, setExpandedAi] = useState<Set<number>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [pasteText, setPasteText] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [savedJobId, setSavedJobId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysisData | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState<number | null>(null);
  const [createParseNote, setCreateParseNote] = useState("");
  const [createPasteText, setCreatePasteText] = useState("");
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const list = await api<JobListItem[]>("/api/v1/jobs?limit=100");
      setJobs(list);
      setListError("");
      await refreshFromJobs();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "加载岗位列表失败");
      setJobs([]);
    }
  }, [refreshFromJobs]);

  const openJobDetail = async (id: number) => {
    setDetailLoading(true);
    setListError("");
    if (analysisJobId !== id) {
      setAnalysis(null);
      setAnalysisJobId(null);
    }
    try {
      const detail = await api<JobDetail>(`/api/v1/jobs/${id}`);
      setSelectedDetail(detail);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "加载岗位详情失败", { tone: "error" });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "library") loadJobs().catch(console.error);
  }, [tab, loadJobs]);

  useEffect(() => {
    if (tab !== "ai") return;
    const next = composeAiSearchQuery(aiCity, aiRoles, aiJobType);
    if (aiCity || aiRoles.length > 0) {
      setAiQuery(next);
    }
  }, [tab, aiCity, aiRoles, aiJobType]);

  const applyParsedToCreateForm = (parsed: ParsedPreview) => {
    const req = parsed.requirements || {};
    setForm({
      company: parsed.company || "",
      title: parsed.title || "",
      city: parsed.city && parsed.city !== "未知" ? parsed.city : "",
      job_type: parsed.job_type || "实习",
      salary_min: parsed.salary_min != null ? String(parsed.salary_min) : "",
      salary_max: parsed.salary_max != null ? String(parsed.salary_max) : "",
      industry: parsed.industry || "",
      description: parsed.description || "",
      education:
        (typeof req.education === "string" && req.education) || "本科及以上",
    });
    setFormTags(parsed.tags || []);
    const skills = [
      ...(Array.isArray(req.required_skills) ? req.required_skills : []),
      ...(Array.isArray(req.preferred_skills) ? req.preferred_skills : []),
    ].filter((s): s is string => typeof s === "string" && !!s);
    setFormSkills([...new Set(skills)]);
    setCreateParseNote(parsed.parse_note || "");
  };

  const parseCreateFile = async (file: File) => {
    setLoading(true);
    clearMessage();
    setCreateParseNote("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api<{
        parsed: ParsedPreview;
        extracted_text: string;
      }>(`/api/v1/jobs/parse-file?save=false`, { method: "POST", body: fd });
      applyParsedToCreateForm(res.parsed);
      showMessage("已从文件识别并填入表单，请核对后保存", { tone: "info" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "文件解析失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const parseCreateImage = async (file: File) => {
    setLoading(true);
    clearMessage();
    setCreateParseNote("");
    setCreateImagePreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api<{ parsed: ParsedPreview }>(
        `/api/v1/jobs/parse-screenshot?save=false`,
        { method: "POST", body: fd }
      );
      applyParsedToCreateForm(res.parsed);
      showMessage("已从图片识别并填入表单，请核对后保存", { tone: "info" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "图片识别失败", { tone: "error" });
      setCreateImagePreview(null);
    } finally {
      setLoading(false);
    }
  };

  const parseCreateText = async () => {
    if (createPasteText.trim().length < 20) {
      showMessage("粘贴内容至少 20 字", { tone: "info" });
      return;
    }
    setLoading(true);
    clearMessage();
    try {
      const res = await api<{ parsed: ParsedPreview }>("/api/v1/jobs/parse-text", {
        method: "POST",
        body: JSON.stringify({ content: createPasteText, save: false }),
      });
      applyParsedToCreateForm(res.parsed);
      showMessage("已从文本识别并填入表单，请核对后保存", { tone: "info" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "文本解析失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessage();
    try {
      await api("/api/v1/jobs", {
        method: "POST",
        body: JSON.stringify({
          company: form.company,
          title: form.title,
          city: form.city,
          job_type: form.job_type,
          salary_min: form.salary_min ? Number(form.salary_min) : null,
          salary_max: form.salary_max ? Number(form.salary_max) : null,
          industry: form.industry || null,
          description: form.description,
          tags: formTags,
          requirements: {
            required_skills: formSkills,
            preferred_skills: [],
            education: form.education,
          },
        }),
      });
      setForm(emptyForm);
      setFormTags([]);
      setFormSkills([]);
      setCreatePasteText("");
      setCreateParseNote("");
      setCreateImagePreview(null);
      setTab("library");
      await loadJobs();
      showMessage("岗位录入成功", { tone: "success" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "录入失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const runAiSearch = async () => {
    const query = composeAiSearchQuery(aiCity, aiRoles, aiJobType) || aiQuery.trim();
    if (query.length < 2) {
      showMessage("请填写城市、岗位方向或搜索语句", { tone: "info" });
      return;
    }
    setAiQuery(query);
    setLoading(true);
    clearMessage();
    setSelectedAi(new Set());
    setExpandedAi(new Set());
    try {
      const res = await api<{
        search_summary: string;
        local_jobs: LocalHit[];
        ai_discovered: AiJob[];
      }>("/api/v1/jobs/ai-search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit: 8,
          include_ai_discovery: true,
          city: aiCity.trim() || null,
          job_type: aiJobType.trim() || null,
          roles: aiRoles,
        }),
      });
      setAiSummary(res.search_summary);
      setLocalHits(res.local_jobs);
      setAiJobs(res.ai_discovered);
      setSelectedAi(new Set(res.ai_discovered.map((_, i) => i)));
      setExpandedAi(new Set([0]));
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "搜索失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const toggleAi = (idx: number) => {
    setSelectedAi((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const importSelected = async () => {
    const toImport = aiJobs.filter((_, i) => selectedAi.has(i));
    if (!toImport.length) {
      showMessage("请勾选要导入的岗位", { tone: "info" });
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ count: number }>("/api/v1/jobs/ai-import", {
        method: "POST",
        body: JSON.stringify({ jobs: toImport }),
      });
      await loadJobs();
      setTab("library");
      showMessage(`已导入 ${res.count} 条岗位到岗位库`, { tone: "success" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "导入失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const deleteJob = async (id: number) => {
    if (!confirm("确定删除该岗位？")) return;
    try {
      await api(`/api/v1/jobs/${id}`, { method: "DELETE" });
      if (selectedDetail?.id === id) setSelectedDetail(null);
      await loadJobs();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "删除失败", { tone: "error" });
    }
  };

  const toggleJobShare = async (job: JobDetail | JobListItem, shared: boolean) => {
    try {
      await api<JobListItem>(`/api/v1/jobs/${job.id}/share`, {
        method: "PATCH",
        body: JSON.stringify({ shared }),
      });
      await loadJobs();
      if (selectedDetail?.id === job.id) {
        const detail = await api<JobDetail>(`/api/v1/jobs/${job.id}`);
        setSelectedDetail(detail);
      }
      showMessage(shared ? "已共享，其他用户可见" : "已取消共享，仅自己可见", { tone: "success" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "操作失败", { tone: "error" });
    }
  };

  const parseText = async () => {
    setLoading(true);
    clearMessage();
    setAnalysis(null);
    try {
      const res = await api<{
        parsed: ParsedPreview;
        extracted_text: string;
        job: { id: number } | null;
      }>("/api/v1/jobs/parse-text", {
        method: "POST",
        body: JSON.stringify({ content: pasteText, save: true }),
      });
      setParsedPreview(res.parsed);
      setExtractedText(res.extracted_text);
      setSavedJobId(res.job?.id ?? null);
      showMessage("已解析并保存为心仪岗位", { tone: "success" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "解析失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const parseScreenshot = async () => {
    if (!screenshotFile) {
      showMessage("请先选择截图", { tone: "info" });
      return;
    }
    setLoading(true);
    clearMessage();
    setAnalysis(null);
    const fd = new FormData();
    fd.append("file", screenshotFile);
    try {
      const res = await api<{
        parsed: ParsedPreview;
        extracted_text: string;
        job: { id: number } | null;
      }>(`/api/v1/jobs/parse-screenshot?save=true`, { method: "POST", body: fd });
      setParsedPreview(res.parsed);
      setExtractedText(res.extracted_text);
      setSavedJobId(res.job?.id ?? null);
      showMessage("截图已识别并保存为心仪岗位", { tone: "success" });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "识别失败", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const runResumeAnalysis = async (jobId?: number) => {
    const id = jobId ?? savedJobId;
    if (!id) {
      showMessage("请先选择或保存岗位", { tone: "info" });
      return;
    }
    setLoading(true);
    setAnalysisJobId(id);
    setAnalysis(null);
    clearMessage();
    try {
      const res = await api<ResumeAnalysisData>(`/api/v1/jobs/${id}/resume-analysis`, {
        method: "POST",
      });
      setAnalysis(res);
      setSavedJobId(id);
      showMessage("简历分析完成", { tone: "success" });
    } catch (err) {
      setAnalysisJobId(null);
      showMessage(err instanceof Error ? err.message : "分析失败，请先在对话页上传简历并配置 API Key", {
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const onScreenshotPick = (file: File | null) => {
    setScreenshotFile(file);
    setScreenshotPreview(file ? URL.createObjectURL(file) : null);
    setParsedPreview(null);
    setAnalysis(null);
  };

  const sourceLabel = (s?: string) => {
    if (s === "manual") return "手动录入";
    if (s === "ai") return "AI 导入";
    if (s === "paste") return "文本导入";
    if (s === "screenshot") return "截图导入";
    if (s === "file") return "文件导入";
    return "系统";
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="shrink-0 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold flex-1">岗位库</h1>
      </header>

      <div className="shrink-0 flex gap-1 p-2 bg-white border-b max-w-6xl mx-auto w-full">
        {(
          [
            ["library", "岗位列表", Database],
            ["favorite", "心仪岗位", Heart],
            ["create", "录入岗位", Plus],
            ["ai", "AI 查找", Bot],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => changeTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ${
              tab === key ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <FlashBanner message={message} tone={tone} onDismiss={clearMessage} />

      <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full p-4 flex flex-col overflow-hidden">
        {tab === "library" && (
          <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
            <div className="w-[42%] min-h-0 flex flex-col shrink-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 overscroll-contain">
              {listError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{listError}</p>
              )}
              {jobs.length === 0 && !listError && (
                <p className="text-gray-400 text-sm">暂无岗位，请录入或使用 AI 查找导入</p>
              )}
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => openJobDetail(job.id)}
                  className={`w-full text-left bg-white rounded-xl border p-4 transition hover:border-brand-200 ${
                    selectedDetail?.id === job.id
                      ? "border-brand-400 ring-1 ring-brand-100"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{job.title}</h3>
                      <p className="text-sm text-gray-500 truncate">
                        {job.company} · {job.city} · {job.job_type}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {sourceLabel(job.source)}
                      </span>
                      {job.shared_by_username ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                          {job.shared_by_username} 共享
                        </span>
                      ) : null}
                      {job.is_mine && job.source !== "seed" ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            job.is_shared
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : "bg-amber-50 text-amber-800 border border-amber-100"
                          }`}
                        >
                          {job.is_shared ? "已共享" : "仅自己"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-brand-600 mt-2">点击查看详情 →</p>
                </button>
              ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-gray-100 p-4 overscroll-contain shadow-sm">
              {detailLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="animate-spin" size={16} />
                  加载中...
                </div>
              )}
              {!detailLoading && !selectedDetail && (
                <p className="text-sm text-gray-400">在左侧选择岗位查看完整 JD</p>
              )}
              {selectedDetail && !detailLoading && (
                <div className="space-y-4 text-sm">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedDetail.title}</h2>
                    <p className="text-gray-500 mt-1">
                      {selectedDetail.company} · {selectedDetail.city} · {selectedDetail.job_type}
                      {selectedDetail.industry ? ` · ${selectedDetail.industry}` : ""}
                    </p>
                    {(selectedDetail.salary_min || selectedDetail.salary_max) && (
                      <p className="text-gray-600 mt-1">
                        薪资：{selectedDetail.salary_min ?? "?"} - {selectedDetail.salary_max ?? "?"}
                      </p>
                    )}
                  </div>
                  {selectedDetail.tags?.length ? (
                    <p className="text-gray-500">标签：{selectedDetail.tags.join("、")}</p>
                  ) : null}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-1">岗位描述</h3>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedDetail.description}
                    </p>
                  </div>
                  {selectedDetail.requirements && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-1">任职要求</h3>
                      {selectedDetail.requirements.required_skills?.length ? (
                        <p className="text-gray-600">
                          必备：{selectedDetail.requirements.required_skills.join("、")}
                        </p>
                      ) : null}
                      {selectedDetail.requirements.preferred_skills?.length ? (
                        <p className="text-gray-600">
                          优先：{selectedDetail.requirements.preferred_skills.join("、")}
                        </p>
                      ) : null}
                      {selectedDetail.requirements.education ? (
                        <p className="text-gray-600">学历：{selectedDetail.requirements.education}</p>
                      ) : null}
                    </div>
                  )}
                  {selectedDetail.source_url ? (
                    <a
                      href={selectedDetail.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      <ExternalLink size={14} />
                      打开招聘链接
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <button
                      type="button"
                      disabled={loading && analysisJobId === selectedDetail.id}
                      onClick={() => runResumeAnalysis(selectedDetail.id)}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700 disabled:opacity-50"
                    >
                      {loading && analysisJobId === selectedDetail.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      结合简历分析
                    </button>
                    {selectedDetail.can_share && (
                      <button
                        type="button"
                        onClick={() => toggleJobShare(selectedDetail, !selectedDetail.is_shared)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border ${
                          selectedDetail.is_shared
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <Share2 size={14} />
                        {selectedDetail.is_shared ? "取消共享" : "共享给其他用户"}
                      </button>
                    )}
                    {selectedDetail.can_edit && (
                      <button
                        type="button"
                        onClick={() => deleteJob(selectedDetail.id)}
                        className="text-xs text-red-500 px-3 py-2 border border-red-100 rounded-lg hover:bg-red-50"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  {loading && analysisJobId === selectedDetail.id && <ResumeAnalysisPanel loading />}
                  {analysis && analysisJobId === selectedDetail.id && !loading && (
                    <ResumeAnalysisPanel analysis={analysis} />
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {tab === "favorite" && (
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <p className="text-sm text-gray-500">
              从招聘 App/网站复制 JD 文字，或上传岗位详情截图，系统将解析岗位并结合你的简历给出匹配与优化建议。
            </p>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileText size={16} />
                粘贴岗位文本
              </div>
              <textarea
                rows={8}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="粘贴岗位职责、任职要求、薪资等信息..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                onClick={parseText}
                disabled={loading || pasteText.trim().length < 20}
                className="w-full py-2 rounded-xl bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                解析文本岗位
              </button>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <ImagePlus size={16} />
                上传岗位截图
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onScreenshotPick(e.target.files?.[0] ?? null)}
              />
              {screenshotPreview && (
                <img
                  src={screenshotPreview}
                  alt="截图预览"
                  className="max-h-48 rounded-lg border object-contain"
                />
              )}
              <button
                onClick={parseScreenshot}
                disabled={loading || !screenshotFile}
                className="w-full py-2 rounded-xl border border-brand-200 text-brand-700 text-sm hover:bg-brand-50 disabled:opacity-50"
              >
                识别截图岗位
              </button>
            </div>

            {parsedPreview && (
              <div className="bg-white rounded-xl border border-brand-100 p-4 space-y-2">
                <h3 className="font-medium">
                  {parsedPreview.title} · {parsedPreview.company}
                </h3>
                <p className="text-sm text-gray-500">
                  {parsedPreview.city} · {parsedPreview.job_type}
                  {parsedPreview.industry ? ` · ${parsedPreview.industry}` : ""}
                </p>
                <p className="text-sm text-gray-600 line-clamp-4">{parsedPreview.description}</p>
                {parsedPreview.parse_note && (
                  <p className="text-xs text-gray-400">{parsedPreview.parse_note}</p>
                )}
                <button
                  onClick={() => runResumeAnalysis()}
                  disabled={loading || !savedJobId}
                  className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  结合简历分析
                </button>
              </div>
            )}

            {extractedText && !parsedPreview && (
              <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-32">{extractedText}</pre>
            )}

            {loading && analysisJobId != null && !analysis && <ResumeAnalysisPanel loading />}
            {analysis && <ResumeAnalysisPanel analysis={analysis} />}
          </div>
        )}

        {tab === "create" && (
          <form onSubmit={submitCreate} className="bg-white rounded-xl border p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileUp size={16} className="text-brand-600" />
                AI 智能录入
              </div>
              <p className="text-xs text-gray-500">
                支持 PDF / Word / TXT、招聘截图（png/jpg）或粘贴文本，AI 识别后自动填入下方表单
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <label
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm cursor-pointer hover:bg-brand-700 ${
                    loading ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  选择文件
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseCreateFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 bg-white text-brand-700 text-sm cursor-pointer hover:bg-brand-50 ${
                    loading ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  上传截图
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseCreateImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-gray-400">文档或招聘 App 截图</span>
              </div>
              {createImagePreview && (
                <img
                  src={createImagePreview}
                  alt="截图预览"
                  className="max-h-40 rounded-lg border object-contain bg-white"
                />
              )}
              <textarea
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="或直接粘贴招聘 JD 原文…"
                value={createPasteText}
                onChange={(e) => setCreatePasteText(e.target.value)}
              />
              <button
                type="button"
                onClick={parseCreateText}
                disabled={loading || createPasteText.trim().length < 20}
                className="w-full py-2 rounded-lg border border-brand-200 text-brand-700 text-sm hover:bg-white disabled:opacity-50"
              >
                从文本识别并填入
              </button>
              {createParseNote && (
                <p className="text-xs text-gray-500 bg-white/80 rounded-lg p-2 border border-gray-100">
                  {createParseNote}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">公司 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="如：字节跳动"
                />
              </div>
              <div>
                <SingleAutocomplete
                  label="岗位名称"
                  required
                  value={form.title}
                  onChange={(title) => setForm({ ...form, title })}
                  options={roleOptions}
                  placeholder="输入岗位名，支持模糊匹配"
                />
              </div>
              <div>
                <SingleAutocomplete
                  label="城市"
                  required
                  value={form.city}
                  onChange={(city) => setForm({ ...form, city })}
                  options={cityOptions}
                  placeholder="输入城市，如：上海"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">类型</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={form.job_type}
                  onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">薪资下限</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  placeholder="实习填日薪，校招填月薪"
                  value={form.salary_min}
                  onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">薪资上限</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.salary_max}
                  onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                />
              </div>
            </div>
            <SingleAutocomplete
              label="行业"
              value={form.industry}
              onChange={(industry) => setForm({ ...form, industry })}
              options={industryOptions}
              placeholder="互联网、金融…"
            />
            <TagAutocomplete
              label="标签"
              value={formTags}
              onChange={setFormTags}
              options={skillOptions}
              placeholder="Python、数据分析…"
              maxItems={12}
            />
            <TagAutocomplete
              label="必备技能"
              value={formSkills}
              onChange={setFormSkills}
              options={skillOptions}
              placeholder="从常用技能中选择或自定义"
              maxItems={15}
            />
            <div>
              <label className="text-sm text-gray-600">学历要求</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                value={form.education}
                onChange={(e) => setForm({ ...form, education: e.target.value })}
              >
                {EDUCATION_LEVELS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">岗位描述 *</label>
              <textarea
                required
                rows={6}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              保存到岗位库
            </button>
          </form>
        )}

        {tab === "ai" && (
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <p className="text-sm text-gray-600">
                选择城市或岗位方向后，会自动同步到下方搜索框；也可直接编辑搜索语句
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SingleAutocomplete
                  label="城市"
                  value={aiCity}
                  onChange={setAiCity}
                  options={cityOptions}
                  placeholder="如：上海"
                />
                <div>
                  <label className="text-sm text-gray-600">类型</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={aiJobType}
                    onChange={(e) => setAiJobType(e.target.value)}
                  >
                    {JOB_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <TagAutocomplete
                label="岗位方向"
                value={aiRoles}
                onChange={setAiRoles}
                options={roleOptions}
                placeholder="数据分析、后端…"
                maxItems={4}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="例如：上海 数据分析 实习"
                />
                <button
                  type="button"
                  onClick={runAiSearch}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white flex items-center gap-2 hover:bg-brand-700 disabled:opacity-50 shrink-0"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  AI 查找
                </button>
              </div>
              <p className="text-xs text-gray-400">
                将同时检索岗位库，并由 AI 发现可能适合的岗位（导入前请到官网核实）
              </p>
            </div>

            {aiSummary && (
              <div className="bg-brand-50 rounded-xl border border-brand-100 p-4 text-sm text-brand-900">
                {aiSummary}
              </div>
            )}

            {localHits.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-700 mb-2">岗位库命中 ({localHits.length})</h2>
                <div className="space-y-2">
                  {localHits.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => {
                        changeTab("library");
                        openJobDetail(job.id);
                      }}
                      className="w-full text-left bg-white rounded-xl border p-3 text-sm hover:border-brand-200"
                    >
                      <div className="font-medium">
                        {job.title} · {job.company}
                      </div>
                      <p className="text-gray-500">
                        {job.city} · {job.job_type}
                      </p>
                      {job.match_reason && (
                        <p className="text-brand-600 text-xs mt-1">{job.match_reason}</p>
                      )}
                      <p className="text-xs text-brand-600 mt-1">在岗位列表中查看详情 →</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {aiJobs.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-medium text-gray-700">AI 发现岗位 ({aiJobs.length})</h2>
                  <button
                    onClick={importSelected}
                    disabled={loading || selectedAi.size === 0}
                    className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    导入选中 ({selectedAi.size})
                  </button>
                </div>
                <div className="space-y-3">
                  {aiJobs.map((job, idx) => {
                    const open = expandedAi.has(idx);
                    const req = job.requirements;
                    return (
                      <div
                        key={idx}
                        className={`bg-white rounded-xl border overflow-hidden ${
                          selectedAi.has(idx) ? "border-brand-400 ring-1 ring-brand-100" : "border-gray-100"
                        }`}
                      >
                        <div className="flex gap-3 p-3">
                          <input
                            type="checkbox"
                            checked={selectedAi.has(idx)}
                            onChange={() => toggleAi(idx)}
                            className="mt-1"
                          />
                          <div className="flex-1 text-sm min-w-0">
                            <div className="font-medium">
                              {job.title} · {job.company}
                            </div>
                            <p className="text-gray-500">
                              {job.city} · {job.job_type}
                              {job.industry ? ` · ${job.industry}` : ""}
                              {(job.salary_min || job.salary_max) &&
                                ` · ${job.salary_min ?? "?"}-${job.salary_max ?? "?"}`}
                            </p>
                            {job.relevance_reason && (
                              <p className="text-brand-600 text-xs mt-1">{job.relevance_reason}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAi((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              })
                            }
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                        {open && (
                          <div className="px-4 pb-4 pt-0 text-sm border-t border-gray-50 space-y-3">
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">岗位描述</h4>
                              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                            </div>
                            {req && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-1">任职要求</h4>
                                {req.required_skills?.length ? (
                                  <p className="text-gray-600">
                                    必备：{req.required_skills.join("、")}
                                  </p>
                                ) : null}
                                {req.preferred_skills?.length ? (
                                  <p className="text-gray-600">
                                    优先：{req.preferred_skills.join("、")}
                                  </p>
                                ) : null}
                                {req.education ? (
                                  <p className="text-gray-600">学历：{req.education}</p>
                                ) : null}
                              </div>
                            )}
                            {job.tags?.length ? (
                              <p className="text-gray-500 text-xs">标签：{job.tags.join("、")}</p>
                            ) : null}
                            {job.source_url ? (
                              <a
                                href={job.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm"
                              >
                                <ExternalLink size={14} />
                                打开招聘链接
                              </a>
                            ) : (
                              <p className="text-amber-600 text-xs">{job.verify_note}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
