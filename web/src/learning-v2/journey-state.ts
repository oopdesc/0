import { catalogHref, type CatalogItem } from "./catalog";
export type CompletionKind =
  "correct" | "assisted" | "code-passed" | "self-check";
export const completionFlags = {
  correct: 1,
  assisted: 2,
  "code-passed": 4,
  "self-check": 8,
} as const;
export const JOURNEY_KEY = "0.journey.progress.v1",
  JOURNEY_EVENT = "zero-question-completed";
export type JourneyProgress = {
  schema: "zero-journey-progress/1";
  records: Record<string, { at: number; evidence: number }>;
};
export const emptyJourney = (): JourneyProgress => ({
  schema: "zero-journey-progress/1",
  records: {},
});
export function questionCompleted(id: string, kind: CompletionKind) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(JOURNEY_EVENT, { detail: { id, kind } }),
    );
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
function validId(x: string) {
  return (
    /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(x) &&
    !["constructor", "prototype", "__proto__"].includes(x)
  );
}
export function validateJourney(
  input: unknown,
  known?: Set<string>,
): JourneyProgress {
  if (
    !object(input) ||
    input.schema !== "zero-journey-progress/1" ||
    !object(input.records) ||
    Object.keys(input.records).length > 6000
  )
    throw Error("レベル記録の形式が不正です。");
  const next = emptyJourney();
  for (const [id, r] of Object.entries(input.records)) {
    if (
      !validId(id) ||
      (known && !known.has(id)) ||
      !object(r) ||
      typeof r.at !== "number" ||
      !Number.isSafeInteger(r.at) ||
      r.at < 0 ||
      r.at > 8640000000000000 ||
      typeof r.evidence !== "number" ||
      !Number.isInteger(r.evidence) ||
      r.evidence < 1 ||
      r.evidence > 15
    )
      throw Error("レベル記録の項目が不正です。");
    next.records[id] = { at: r.at, evidence: r.evidence };
  }
  return next;
}
export function mergeJourney(
  a: JourneyProgress,
  b: JourneyProgress,
): JourneyProgress {
  const next = validateJourney(a);
  validateJourney(b);
  for (const [id, r] of Object.entries(b.records)) {
    const old = next.records[id];
    next.records[id] = old
      ? { at: Math.max(old.at, r.at), evidence: old.evidence | r.evidence }
      : { ...r };
  }
  return validateJourney(next);
}
export function completeJourney(
  state: JourneyProgress,
  id: string,
  kind: CompletionKind,
  known: Set<string>,
  now = Date.now(),
) {
  if (!known.has(id) || !Object.hasOwn(completionFlags, kind))
    throw Error("このカリキュラムの問題ではありません。");
  return mergeJourney(state, {
    schema: "zero-journey-progress/1",
    records: { [id]: { at: now, evidence: completionFlags[kind] } },
  });
}
export function readJourney(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(JOURNEY_KEY);
    if (raw && raw.length > 1000000) throw Error("記録が大きすぎます。");
    return {
      state: raw ? validateJourney(JSON.parse(raw)) : emptyJourney(),
      writable: true,
      error: "",
    };
  } catch {
    return {
      state: emptyJourney(),
      writable: false,
      error:
        "保存済みのレベル記録を読み取れません。上書きせずに停止しています。",
    };
  }
}
export function saveJourney(
  storage: Pick<Storage, "getItem" | "setItem">,
  state: JourneyProgress,
): JourneyProgress {
  const old = readJourney(storage);
  if (!old.writable) throw Error(old.error);
  const next = mergeJourney(old.state, state);
  storage.setItem(JOURNEY_KEY, JSON.stringify(next));
  return next;
}
export function validateJourneyOrder(data: unknown, items: CatalogItem[]) {
  if (
    !object(data) ||
    data.schema !== "zero-journey-order/1" ||
    !Array.isArray(data.order) ||
    data.order.length !== items.length ||
    new Set(data.order).size !== items.length ||
    data.order.some(
      (x) =>
        typeof x !== "number" ||
        !Number.isInteger(x) ||
        x < 0 ||
        x >= items.length,
    )
  )
    throw Error("カリキュラムの索引が不正です。");
  return (data.order as number[]).map((i) => items[i]);
}
export function journeyHref(item: CatalogItem) {
  return "/learn?" + new URLSearchParams({ section: "journey", step: item.id });
}
export function originalHref(item: CatalogItem) {
  return catalogHref(item.id, item.language);
}
export const completionLabel = (e: number) =>
  e & 4
    ? "固定テストで確認"
    : e & 1
      ? "正答を確認"
      : e & 2
        ? "手がかり付きで正答"
        : "自分で確認";
