import type { Lang, Level } from "./types";
export type CatalogItem = {
  id: string;
  title: string;
  language: Lang;
  level: Level;
  source: "normal" | "supplemental" | "exam" | "legacy";
  codeKey: string | null;
  topics: string;
};
export type CatalogFilter = {
  language: string;
  level: string;
  kind: string;
  source: string;
  query: string;
};
export function catalogState(search: string): {
  filter: CatalogFilter;
  page: number;
} {
  const p = new URLSearchParams(search),
    pick = (key: string, values: string[]) =>
      values.includes(p.get(key) ?? "") ? p.get(key)! : "all";
  const n = Number(p.get("page") ?? 0);
  return {
    filter: {
      language: pick("lang", ["java", "rust"]),
      level: pick("level", ["beginner", "intermediate", "advanced"]),
      kind: pick("kind", ["prediction", "code"]),
      source: pick("source", ["normal", "supplemental", "exam", "legacy"]),
      query: (p.get("query") ?? "").slice(0, 160),
    },
    page: Number.isInteger(n) && n >= 0 ? Math.min(199, n) : 0,
  };
}
export function catalogSearch(filter: CatalogFilter, page = 0) {
  const p = new URLSearchParams({ section: "catalog" });
  for (const [key, value] of [
    ["lang", filter.language],
    ["level", filter.level],
    ["kind", filter.kind],
    ["source", filter.source],
    ["query", filter.query],
  ])
    if (value && value !== "all") p.set(key, value);
  if (page > 0) p.set("page", String(page));
  return "/learn?" + p;
}
export function catalogHref(id: string, lang: Lang): string {
  if (new RegExp("^" + lang + ":q[0-9]{4,}$").test(id))
    return "/learn?" + new URLSearchParams({ section: "drill", lang, q: id });
  if (/^academy:[A-Za-z0-9._-]+$/.test(id))
    return "/learn?section=supplemental#/p/" + encodeURIComponent(id.slice(8));
  if (/^practice:[A-Za-z0-9._-]+$/.test(id)) {
    const key = id.slice(9);
    return (
      "/learn?" +
      new URLSearchParams({
        section: "legacy-verified",
        lang: key.startsWith("b-") ? "bridge" : lang,
        legacyQuestion: key,
      })
    );
  }
  const exam = /^(java|rust):([A-Za-z0-9_-]+):q[0-9]+$/.exec(id);
  if (exam && exam[1] === lang)
    return (
      "/learn?" +
      new URLSearchParams({
        section: "exams",
        lang,
        exam: lang + ":" + exam[2],
        examQuestion: id,
      })
    );
  throw Error("問題一覧の参照IDが不正です。");
}
export function validateCatalog(data: unknown): CatalogItem[] {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("問題一覧を読み取れません。");
  const d = data as Record<string, unknown>;
  if (
    d.schema !== "zero-question-catalog/2" ||
    !Array.isArray(d.items) ||
    d.items.length !== d.total ||
    d.items.length > 6000
  )
    throw Error("問題一覧の件数が不正です。");
  const seen = new Set<string>();
  return d.items.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length !== 7 ||
      typeof row[0] !== "string" ||
      seen.has(row[0]) ||
      typeof row[1] !== "string" ||
      !row[1].trim() ||
      row[1].length > 300 ||
      ![0, 1].includes(row[2]) ||
      ![0, 1, 2].includes(row[3]) ||
      ![0, 1, 2, 3].includes(row[4]) ||
      !(row[5] === null || typeof row[5] === "string") ||
      typeof row[6] !== "string" ||
      row[6].length > 600
    )
      throw Error("問題一覧の項目が不正です。");
    const language: Lang = row[2] === 0 ? "java" : "rust";
    catalogHref(row[0], language);
    if (row[5] !== null) catalogHref(row[5], language);
    seen.add(row[0]);
    return {
      id: row[0],
      title: row[1],
      language,
      level: (["beginner", "intermediate", "advanced"] as const)[row[3]],
      source: (["normal", "supplemental", "exam", "legacy"] as const)[row[4]],
      codeKey: row[5],
      topics: row[6],
    };
  });
}
export async function loadCatalog(signal?: AbortSignal) {
  let r: Response;
  try {
    r = await fetch("/learning-v2/catalog.json", { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Error(
      "問題一覧に接続できません。通信状況を確認して、読み直してください。",
    );
  }
  if (!r.ok) throw Error("問題一覧を取得できません。");
  if (Number(r.headers.get("content-length") || 0) > 1500000)
    throw Error("問題一覧が大きすぎます。");
  let s: string;
  try {
    s = await r.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Error(
      "問題一覧の受信が途中で止まりました。もう一度読み直してください。",
    );
  }
  if (new TextEncoder().encode(s).byteLength > 1500000)
    throw Error("問題一覧が大きすぎます。");
  let data: unknown;
  try {
    data = JSON.parse(s);
  } catch {
    throw Error("問題一覧の形式を読み取れません。画面を更新してください。");
  }
  return validateCatalog(data);
}
export function searchCatalog(items: CatalogItem[], filter: CatalogFilter) {
  const terms = filter.query
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 12);
  return items.filter(
    (q) =>
      (filter.language === "all" || q.language === filter.language) &&
      (filter.level === "all" || q.level === filter.level) &&
      (filter.kind === "all" ||
        (filter.kind === "code" ? q.codeKey !== null : q.codeKey === null)) &&
      (filter.source === "all" || q.source === filter.source) &&
      terms.every((t) =>
        (q.title + " " + q.id + " " + q.topics)
          .normalize("NFKC")
          .toLocaleLowerCase("ja-JP")
          .includes(t),
      ),
  );
}
