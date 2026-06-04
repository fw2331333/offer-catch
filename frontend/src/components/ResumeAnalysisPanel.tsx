import { Loader2 } from "lucide-react";

export type ResumeAnalysisData = {
  job_id: number;
  job_title: string;
  company: string;
  overall_score: number;
  recommendation: string;
  match_summary: string;
  matched_items: { item: string; evidence: string }[];
  gaps: { item: string; suggestion: string }[];
  risks: string[];
  optimization_summary: string;
  suggestions: { priority: string; action: string; issue?: string }[];
};

type Props =
  | { loading: true; analysis?: never }
  | { loading?: false; analysis: ResumeAnalysisData };

export default function ResumeAnalysisPanel(props: Props) {
  if (props.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4 mt-3">
        <Loader2 size={16} className="animate-spin text-brand-600" />
        正在结合简历分析，请稍候（约 30～60 秒）…
      </div>
    );
  }

  const { analysis } = props;
  return (
    <div className="bg-brand-50/50 rounded-xl border border-brand-100 p-4 space-y-4 text-sm mt-3">
      <div>
        <h3 className="font-medium text-lg text-gray-800">
          {analysis.company} · {analysis.job_title}
        </h3>
        <p className="text-brand-800 font-medium mt-1">
          匹配分 {analysis.overall_score.toFixed(0)} · 建议 {analysis.recommendation}
        </p>
        <p className="text-gray-600 mt-2 leading-relaxed">{analysis.match_summary}</p>
      </div>
      {analysis.matched_items?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-1">匹配项</h4>
          <ul className="space-y-1 text-gray-600">
            {analysis.matched_items.map((m, i) => (
              <li key={i}>
                · {m.item}
                {m.evidence ? ` — ${m.evidence}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.gaps?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-1">待补齐</h4>
          <ul className="space-y-1 text-amber-800">
            {analysis.gaps.map((g, i) => (
              <li key={i}>
                · {g.item}：{g.suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.risks?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-1">风险</h4>
          <ul className="text-red-600">
            {analysis.risks.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="border-t border-brand-100 pt-3">
        <h4 className="font-medium text-gray-700 mb-1">简历优化</h4>
        <p className="text-gray-600 leading-relaxed">{analysis.optimization_summary}</p>
        <ul className="mt-2 space-y-1">
          {(analysis.suggestions || []).map((s, i) => (
            <li key={i} className="text-gray-700">
              [{s.priority}] {s.action || s.issue}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
