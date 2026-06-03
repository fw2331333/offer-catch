/** 简单模糊匹配评分，用于下拉排序 */

export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.trim().toLowerCase();
  if (!q) return 50;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 75;

  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 55;

  return 0;
}

export function filterSuggestions(
  options: string[],
  query: string,
  selected: string[] = [],
  limit = 12
): string[] {
  const selectedSet = new Set(selected.map((s) => s.toLowerCase()));
  const scored = options
    .filter((o) => !selectedSet.has(o.toLowerCase()))
    .map((o) => ({ o, s: fuzzyScore(query, o) }))
    .filter((x) => x.s > 0 || !query.trim())
    .sort((a, b) => b.s - a.s);

  if (!query.trim()) {
    return scored.slice(0, limit).map((x) => x.o);
  }
  return scored.filter((x) => x.s >= 55).slice(0, limit).map((x) => x.o);
}

export function mergeOptions(...lists: (string | undefined | null)[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const v = (item || "").trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
