import type { Lang, Level } from "./types";
import type { Progress, ProgressRecord } from "./progress";
import { recordKey } from "./progress";
export type StudyItem = {
  id: string;
  language: Lang;
  title: string;
  version: string;
  level: Level;
  writing: boolean;
  unit: number;
  order: number;
  concepts: string[];
  prerequisites: string[];
};
export type StudyIndex = {
  schema: "zero-study-index/1";
  items: StudyItem[];
  concepts: Record<string, { name: string; language: Lang }>;
};
export type StudyFilter = {
  language: "all" | Lang;
  level: "all" | Level;
  kind: "all" | "prediction" | "code";
  limit: number;
  includeNew: boolean;
};
export type PlannedItem = {
  item: StudyItem;
  reason: "due" | "retry" | "draft" | "new";
  record?: ProgressRecord;
  prerequisiteNames: string[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const conceptId = (v: unknown): v is string =>
  typeof v === "string" && /^(java|rust):[A-Za-z0-9._:-]{1,110}$/.test(v);
export function encodeStudyIndex(index: StudyIndex) {
  validateStudyIndex(index);
  const concepts = Object.entries(index.concepts).map(([id, c]) => [
    id,
    c.language,
    c.name,
  ]);
  const positions = new Map(concepts.map((c, i) => [c[0], i]));
  const versions = [...new Set(index.items.map((x) => x.version))];
  return {
    schema: "zero-study-index/2",
    versions,
    concepts,
    items: index.items.map((q) => [
      q.id,
      q.title,
      versions.indexOf(q.version),
      ["beginner", "intermediate", "advanced"].indexOf(q.level),
      Number(q.writing),
      q.unit,
      q.order,
      q.concepts.map((c) => positions.get(c)),
      q.prerequisites.map((c) => positions.get(c)),
    ]),
  };
}
export function validateStudyIndex(value: unknown): StudyIndex {
  if (object(value) && value.schema === "zero-study-index/2") {
    if (
      !Array.isArray(value.versions) ||
      !value.versions.length ||
      value.versions.length > 64 ||
      !value.versions.every(
        (v) => typeof v === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(v),
      ) ||
      !Array.isArray(value.concepts) ||
      value.concepts.length > 4000 ||
      !Array.isArray(value.items) ||
      value.items.length > 6000
    )
      throw Error("学習の索引の表が不正です。");
    const concepts: StudyIndex["concepts"] = {},
      conceptIds: string[] = [];
    for (const c of value.concepts) {
      if (
        !Array.isArray(c) ||
        c.length !== 3 ||
        !conceptId(c[0]) ||
        Object.hasOwn(concepts, c[0]) ||
        !["java", "rust"].includes(c[1]) ||
        typeof c[2] !== "string"
      )
        throw Error("概念の索引が不正です。");
      conceptIds.push(c[0]);
      concepts[c[0]] = { language: c[1] as Lang, name: c[2] };
    }
    const versions = value.versions,
      items: unknown[] = [];
    for (const q of value.items) {
      if (
        !Array.isArray(q) ||
        q.length !== 9 ||
        typeof q[0] !== "string" ||
        !Number.isInteger(q[2]) ||
        q[2] < 0 ||
        q[2] >= versions.length ||
        ![0, 1, 2].includes(q[3]) ||
        ![0, 1].includes(q[4]) ||
        ![q[7], q[8]].every(
          (a) =>
            Array.isArray(a) &&
            a.length <= 50 &&
            a.every(
              (n) => Number.isInteger(n) && n >= 0 && n < conceptIds.length,
            ),
        )
      )
        throw Error("問題の索引の参照が不正です。");
      items.push({
        id: q[0],
        title: q[1],
        language: q[0].split(":")[0],
        version: versions[q[2]],
        level: ["beginner", "intermediate", "advanced"][q[3]],
        writing: q[4] === 1,
        unit: q[5],
        order: q[6],
        concepts: q[7].map((n: number) => conceptIds[n]),
        prerequisites: q[8].map((n: number) => conceptIds[n]),
      });
    }
    return validateStudyIndex({
      schema: "zero-study-index/1",
      items,
      concepts,
    });
  }

  if (
    !object(value) ||
    value.schema !== "zero-study-index/1" ||
    !Array.isArray(value.items) ||
    value.items.length > 6000 ||
    !object(value.concepts) ||
    Object.keys(value.concepts).length > 4000
  )
    throw Error("学習の索引を読み取れません。");
  const ids = new Set<string>();
  for (const [id, c] of Object.entries(value.concepts))
    if (
      !conceptId(id) ||
      !object(c) ||
      !["java", "rust"].includes(String(c.language)) ||
      !id.startsWith(c.language + ":") ||
      typeof c.name !== "string" ||
      c.name.length < 1 ||
      c.name.length > 200
    )
      throw Error("概念の索引が不正です。");
  for (const x of value.items) {
    if (
      !object(x) ||
      typeof x.id !== "string" ||
      !/^(java|rust):q[0-9]{4,}$/.test(x.id) ||
      ids.has(x.id) ||
      !["java", "rust"].includes(String(x.language)) ||
      !x.id.startsWith(x.language + ":") ||
      typeof x.title !== "string" ||
      !x.title.trim() ||
      x.title.length > 250 ||
      typeof x.version !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(x.version) ||
      !["beginner", "intermediate", "advanced"].includes(String(x.level)) ||
      typeof x.writing !== "boolean" ||
      !Number.isInteger(x.unit) ||
      (x.unit as number) < 0 ||
      !Number.isInteger(x.order) ||
      (x.order as number) < 0 ||
      ![x.concepts, x.prerequisites].every(
        (a) =>
          Array.isArray(a) &&
          a.length <= 50 &&
          a.every(
            (id) =>
              conceptId(id) &&
              id.startsWith(x.language + ":") &&
              Object.hasOwn(value.concepts as object, id),
          ),
      )
    )
      throw Error("問題の索引が不正です。");
    ids.add(x.id);
  }
  return value as unknown as StudyIndex;
}
export async function loadStudyIndex(
  signal?: AbortSignal,
): Promise<StudyIndex> {
  const r = await fetch("/learning-v2/study-index.json", { signal });
  if (!r.ok)
    throw Error("学習の索引を取得できません（HTTP " + r.status + "）。");
  if (Number(r.headers.get("content-length") || 0) > 1_500_000)
    throw Error("学習の索引が大きすぎます。");
  const text = await r.text();
  if (new TextEncoder().encode(text).byteLength > 1_500_000)
    throw Error("学習の索引が大きすぎます。");
  return validateStudyIndex(JSON.parse(text));
}
export const itemKey = (q: StudyItem) =>
  recordKey(q.id, q.version, q.writing ? "code" : "prediction");
const attempted = (r?: ProgressRecord) => !!r && r.lastAttemptAt !== null;
const needsRetry = (r: ProgressRecord) =>
  r.lastOutcome === "wrong" ||
  r.lastOutcome === "code-failed" ||
  (!r.lastOutcome && r.wrong > 0 && r.blindCorrect + r.assistedCorrect === 0);
export function studySummary(
  index: StudyIndex,
  state: Progress,
  now = Date.now(),
) {
  let seen = 0,
    due = 0,
    retry = 0,
    independent = 0,
    codePassed = 0,
    assisted = 0,
    recall = 0;
  const keys = new Set(index.items.map(itemKey));
  for (const q of index.items) {
    const r = state.records[itemKey(q)];
    if (!r) continue;
    if (attempted(r)) seen++;
    if (attempted(r) && r.dueAt !== null && r.dueAt <= now) due++;
    if (needsRetry(r)) retry++;
    if (r.blindCorrect > 0) independent++;
    if ((r.codePasses ?? 0) > 0) codePassed++;
    if (r.assistedCorrect > 0) assisted++;
    if (r.recalls > 0) recall++;
  }
  return {
    total: index.items.length,
    seen,
    due,
    retry,
    independent,
    codePassed,
    assisted,
    recall,
    retained: Object.keys(state.records).filter((k) => !keys.has(k)).length,
  };
}
export function planStudy(
  index: StudyIndex,
  state: Progress,
  filter: StudyFilter,
  now = Date.now(),
): PlannedItem[] {
  const known = new Set<string>();
  for (const q of index.items) {
    const r = state.records[itemKey(q)];
    if (r && (r.blindCorrect > 0 || (r.codePasses ?? 0) > 0 || r.recalls > 0))
      q.concepts.forEach((c) => known.add(c));
  }
  const ranked: {
    planned: PlannedItem;
    priority: number;
    at: number;
    missing: number;
  }[] = [];
  for (const q of index.items) {
    if (
      (filter.language !== "all" && q.language !== filter.language) ||
      (filter.level !== "all" && q.level !== filter.level) ||
      (filter.kind === "code" && !q.writing) ||
      (filter.kind === "prediction" && q.writing)
    )
      continue;
    const key = itemKey(q),
      r = state.records[key],
      at = r?.lastAttemptAt ?? 0;
    let reason: PlannedItem["reason"] | null = null,
      priority = 9;
    if (attempted(r) && r.dueAt !== null && r.dueAt <= now) {
      reason = "due";
      priority = 0;
    } else if (r && needsRetry(r)) {
      reason = "retry";
      priority = 1;
    } else if (!attempted(r) && state.drafts[key]?.content.trim()) {
      reason = "draft";
      priority = 2;
    } else if (!attempted(r) && filter.includeNew) {
      reason = "new";
      priority = 3;
    }
    if (!reason) continue;
    const missing = q.prerequisites.filter((c) => !known.has(c));
    ranked.push({
      planned: {
        item: q,
        reason,
        record: r,
        prerequisiteNames: missing.map((id) => index.concepts[id]?.name ?? id),
      },
      priority,
      at: reason === "due" ? r!.dueAt! : at,
      missing: missing.length,
    });
  }
  const levels = { beginner: 0, intermediate: 1, advanced: 2 };
  ranked.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.priority === 0 ? a.at - b.at : 0) ||
      (a.priority >= 2
        ? a.missing - b.missing ||
          levels[a.planned.item.level] - levels[b.planned.item.level]
        : a.at - b.at) ||
      a.planned.item.unit - b.planned.item.unit ||
      a.planned.item.order - b.planned.item.order ||
      a.planned.item.id.localeCompare(b.planned.item.id),
  );
  // Interleave languages when learning both. A due item always precedes a new one.
  if (filter.language === "all")
    for (let start = 0; start < ranked.length;) {
      let end = start + 1;
      while (
        end < ranked.length &&
        ranked[end].priority === ranked[start].priority
      )
        end++;
      const group = ranked.slice(start, end),
        a = group.filter((x) => x.planned.item.language === "java"),
        b = group.filter((x) => x.planned.item.language === "rust"),
        mixed: typeof group = [];
      while (a.length || b.length) {
        if (a.length) mixed.push(a.shift()!);
        if (b.length) mixed.push(b.shift()!);
      }
      ranked.splice(start, end - start, ...mixed);
      start = end;
    }
  return ranked
    .slice(0, Math.min(50, Math.max(1, Math.floor(filter.limit) || 10)))
    .map((x) => x.planned);
}
export function studyHref(q: StudyItem) {
  return (
    "/learn?section=drill&lang=" + q.language + "&q=" + encodeURIComponent(q.id)
  );
}
