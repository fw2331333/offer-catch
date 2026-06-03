import { useGSAP } from "@gsap/react";
import { ArrowLeft, FileSearch, Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { streamAnalyzeBatch } from "../api/matchStream";
import { api } from "../api/client";
import type { MatchListItem } from "../api/types";
import MarkdownMessage from "../components/MarkdownMessage";
import { useEntranceAnimation } from "../hooks/useEntranceAnimation";
import { useScrollStagger } from "../hooks/useScrollStagger";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { gsap } from "../lib/gsap";

const BATCH_SIZE = 5;

function recommendationLabel(rec: string): string {
  if (rec === "strong") return "强烈推荐";
  if (rec === "skip") return "暂不推荐";
  if (rec === "try") return "可尝试";
  return rec;
}

function mergeItem(prev: MatchListItem[], item: MatchListItem): MatchListItem[] {
  return prev.map((x) => (x.job_id === item.job_id ? { ...x, ...item } : x));
}

function patchJob(
  prev: MatchListItem[],
  jobId: number,
  patch: Partial<MatchListItem>
): MatchListItem[] {
  return prev.map((x) => (x.job_id === jobId ? { ...x, ...patch } : x));
}

export default function MatchPage() {
  const [items, setItems] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const listScopeRef = useRef<HTMLDivElement>(null);
  const listScrollerRef = useRef<HTMLDivElement>(null);
  const reportPanelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const listKey = useMemo(() => items.map((i) => i.job_id).join(","), [items]);

  useScrollStagger(listScopeRef, [listKey], {
    selector: ".match-card",
    scrollerRef: listScrollerRef,
    start: "top 90%",
  });

  useEntranceAnimation(pageRef, [reducedMotion], {
    selector: ".match-enter",
    y: 12,
    stagger: 0.06,
  });

  useGSAP(
    () => {
      if (reducedMotion || !report) return;
      const el = reportPanelRef.current?.querySelector(".match-report-body");
      if (!el) return;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform",
        }
      );
    },
    { scope: reportPanelRef, dependencies: [report, reducedMotion] }
  );

  const firstPendingIndex = items.findIndex(
    (i) => i.analysis_status === "pending" || i.analysis_status === "failed"
  );
  const completedBeforeFirstPending =
    firstPendingIndex > 0 &&
    items.slice(0, firstPendingIndex).every((i) => i.analysis_status === "completed");

  const runBatch = useCallback(async (jobIds: number[]) => {
    if (jobIds.length === 0) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBatchRunning(true);

    jobIds.forEach((id) => {
      setItems((prev) =>
        patchJob(prev, id, { analysis_status: "analyzing", progress: 0 })
      );
    });

    try {
      await streamAnalyzeBatch(
        jobIds,
        (ev) => {
          if (ev.type === "job_start" || ev.type === "job_progress") {
            setItems((prev) =>
              patchJob(prev, ev.job_id, {
                analysis_status: "analyzing",
                progress: ev.progress,
              })
            );
          } else if (ev.type === "job_done") {
            setItems((prev) => mergeItem(prev, ev.item));
          } else if (ev.type === "job_failed") {
            setItems((prev) =>
              patchJob(prev, ev.job_id, {
                analysis_status: "failed",
                progress: 0,
                explanation: ev.message,
              })
            );
          }
        },
        ac.signal
      );
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        alert(err.message);
      }
    } finally {
      setBatchRunning(false);
      setItems((prev) =>
        prev.map((i) =>
          i.analysis_status === "analyzing" && i.progress <= 0
            ? { ...i, analysis_status: "pending", progress: 0 }
            : i
        )
      );
    }
  }, []);

  const recommend = async () => {
    abortRef.current?.abort();
    setLoading(true);
    setReport("");
    setSelectedJob(null);
    try {
      const res = await api<{
        items: MatchListItem[];
        batch_size: number;
        resume_uploaded: boolean;
      }>("/api/v1/match/recommend", {
        method: "POST",
        body: JSON.stringify({ limit: 30 }),
      });
      setItems(res.items);
      if (!res.resume_uploaded) {
        alert("请先在对话页左侧「我的简历」上传简历，并配置 API Key");
        return;
      }
      const firstIds = res.items.slice(0, BATCH_SIZE).map((i) => i.job_id);
      if (firstIds.length > 0) {
        await runBatch(firstIds);
      }
    } finally {
      setLoading(false);
    }
  };

  const continueAnalyze = () => {
    if (firstPendingIndex < 0 || batchRunning) return;
    const nextIds = items
      .slice(firstPendingIndex, firstPendingIndex + BATCH_SIZE)
      .map((i) => i.job_id);
    runBatch(nextIds);
  };

  const viewReport = async (jobId: number) => {
    setSelectedJob(jobId);
    setReportLoading(true);
    const done = items.find((i) => i.job_id === jobId)?.analysis_status === "completed";
    if (!done) {
      setReport("正在生成分析报告，请稍候…");
    }
    try {
      const r = await api<{
        title: string;
        company: string;
        overall_score: number;
        summary: string;
        matched_items: { item: string; evidence: string }[];
        gaps: { item: string; suggestion: string }[];
        risks: string[];
        recommendation: string;
      }>(`/api/v1/match/jobs/${jobId}/report`);

      setItems((prev) =>
        patchJob(prev, jobId, {
          analysis_status: "completed",
          progress: 100,
          overall_score: r.overall_score,
          explanation: r.summary,
          recommendation: r.recommendation,
        })
      );

      const lines = [
        `# ${r.title} @ ${r.company}`,
        `综合匹配分：**${r.overall_score.toFixed(0)}** · 建议：${recommendationLabel(r.recommendation)}`,
        "",
        r.summary,
        "",
        "## 匹配项",
        ...(r.matched_items || []).map((m) => `- ${m.item}：${m.evidence}`),
        "",
        "## 缺口",
        ...(r.gaps || []).map((g) => `- ${g.item}：${g.suggestion}`),
        "",
        "## 风险",
        ...(r.risks || []).map((x) => `- ${x}`),
      ];
      setReport(lines.join("\n"));
    } catch (err) {
      setReport(err instanceof Error ? err.message : "加载报告失败");
    } finally {
      setReportLoading(false);
    }
  };

  const optimize = async (jobId: number) => {
    setSelectedJob(jobId);
    setReportLoading(true);
    try {
      const r = await api<{ summary: string; suggestions: { priority: string; action: string }[] }>(
        "/api/v1/resumes/optimize",
        { method: "POST", body: JSON.stringify({ job_id: jobId }) }
      );
      const text = [
        "## 简历优化建议",
        r.summary,
        "",
        ...(r.suggestions || []).map(
          (s) => `- [${s.priority}] ${s.action || (s as { issue?: string }).issue}`
        ),
      ].join("\n");
      setReport(text);
    } catch (err) {
      setReport(err instanceof Error ? err.message : "优化失败");
    } finally {
      setReportLoading(false);
    }
  };

  const renderScore = (item: MatchListItem) => {
    if (item.analysis_status === "completed" && item.overall_score != null) {
      return (
        <span className="text-lg font-semibold text-brand-600 tabular-nums">
          {item.overall_score.toFixed(0)}
        </span>
      );
    }
    if (item.analysis_status === "analyzing") {
      if (item.progress <= 0) {
        return <span className="text-sm text-gray-400">分析中</span>;
      }
      return (
        <span className="text-sm font-medium text-brand-600 tabular-nums animate-pulse">
          {item.progress}%
        </span>
      );
    }
    if (item.analysis_status === "failed") {
      return <span className="text-sm text-red-500">失败</span>;
    }
    return <span className="text-sm text-gray-400">未分析</span>;
  };

  return (
    <div ref={pageRef} className="min-h-screen bg-gray-50 flex flex-col">
      <header className="match-enter bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm shadow-gray-100/80">
        <Link to="/" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold flex-1">岗位库匹配</h1>
        <button
          onClick={recommend}
          disabled={loading || batchRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {loading ? "加载中..." : batchRunning ? "AI 分析中..." : "开始推荐"}
        </button>
      </header>

      <div className="flex-1 flex max-w-6xl mx-auto w-full p-4 gap-4 min-h-0">
        <div ref={listScopeRef} className="w-1/2 min-h-0 flex flex-col">
        <div ref={listScrollerRef} className="space-y-3 overflow-y-auto min-h-0 flex-1 pr-1">
          {items.length === 0 && !loading && (
            <p className="text-gray-400 text-sm p-4">
              点击「开始推荐」：先按意向规则排序，再自动 AI 精排前 5 个岗位（请先上传简历并配置 API Key）
            </p>
          )}
          {items.map((item, index) => {
            const showContinue =
              !batchRunning &&
              index === firstPendingIndex &&
              firstPendingIndex >= BATCH_SIZE &&
              completedBeforeFirstPending;

            return (
              <div
                key={item.job_id}
                className={`match-card bg-white rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
                  selectedJob === item.job_id
                    ? "border-brand-400 ring-1 ring-brand-100"
                    : "border-gray-100"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-gray-500">
                      {item.company} · {item.city}
                    </p>
                  </div>
                  {renderScore(item)}
                </div>

                {item.analysis_status === "analyzing" && item.progress > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </div>
                )}

                {item.explanation && item.analysis_status === "completed" && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.explanation}</p>
                )}

                {showContinue && (
                  <button
                    type="button"
                    onClick={continueAnalyze}
                    className="mt-2 w-full text-xs py-2 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  >
                    继续分析（下 {BATCH_SIZE} 个）
                  </button>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => viewReport(item.job_id)}
                    disabled={reportLoading && selectedJob === item.job_id}
                    className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
                  >
                    {reportLoading && selectedJob === item.job_id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileSearch size={14} />
                    )}
                    匹配报告
                  </button>
                  <button
                    onClick={() => optimize(item.job_id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100"
                  >
                    简历优化
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        <div
          ref={reportPanelRef}
          className="match-enter w-1/2 bg-white rounded-xl border border-gray-100 p-4 overflow-y-auto min-h-0 flex flex-col shadow-sm"
        >
          <h2 className="font-medium mb-3 text-gray-700 shrink-0">分析报告</h2>
          {report ? (
            <div className="match-report-body flex-1 min-h-0">
              <MarkdownMessage content={report} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">选择岗位查看匹配报告或简历优化建议</p>
          )}
        </div>
      </div>
    </div>
  );
}
