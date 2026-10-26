import { resources } from "./data";
import { LESSON_IDS } from "./lesson-ids";
export const STORAGE_KEY = "mk0.learning.v1";
export type SavedState = {
  schema: 1;
  favorites: string[];
  completed: string[];
  motion: "auto" | "paused";
  reviews: Record<string, { last: number; due: number; successes: number }>;
};
export const emptyState = (): SavedState => ({
  schema: 1,
  favorites: [],
  completed: [],
  motion: "auto",
  reviews: {},
});
const ids = (value: unknown, allowed: Set<string>): string[] =>
  !Array.isArray(value)
    ? []
    : [
        ...new Set(
          value.filter(
            (x): x is string => typeof x === "string" && allowed.has(x),
          ),
        ),
      ].slice(0, 30);
export function validateSavedState(value: unknown): SavedState {
  if (
    !value ||
    typeof value !== "object" ||
    !("schema" in value) ||
    value.schema !== 1
  )
    return emptyState();
  const v = value as Record<string, unknown>;
  const reviews: SavedState["reviews"] = {};
  if (v.reviews && typeof v.reviews === "object" && !Array.isArray(v.reviews)) {
    for (const id of LESSON_IDS) {
      const item = (v.reviews as Record<string, unknown>)[id];
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (
        typeof r.last === "number" &&
        Number.isFinite(r.last) &&
        r.last >= 0 &&
        r.last <= 4102444800000 &&
        typeof r.due === "number" &&
        Number.isFinite(r.due) &&
        r.due >= r.last &&
        r.due <= 4102444800000 &&
        Number.isInteger(r.successes) &&
        Number(r.successes) >= 0 &&
        Number(r.successes) <= 1000
      )
        reviews[id] = {
          last: r.last,
          due: r.due,
          successes: Number(r.successes),
        };
    }
  }
  return {
    schema: 1,
    favorites: ids(v.favorites, new Set(resources.map((x) => x.id))),
    completed: ids(v.completed, new Set(LESSON_IDS)),
    motion: v.motion === "paused" ? "paused" : "auto",
    reviews,
  };
}
export function recordReview(
  state: SavedState,
  id: string,
  recalled: boolean,
  intervalDays: number,
  now = Date.now(),
): SavedState {
  if (
    !(LESSON_IDS as readonly string[]).includes(id) ||
    !Number.isFinite(now) ||
    now < 0 ||
    now > 4100000000000
  )
    return state;
  const previous = state.reviews[id];
  // 同じ日に何度も押して、復習間隔だけが伸びないようにする。
  if (recalled && previous && now - previous.last < 20 * 60 * 60 * 1000)
    return state;
  const days = Number.isFinite(intervalDays)
    ? Math.max(1, Math.min(30, Math.floor(intervalDays)))
    : 1;
  return {
    ...state,
    reviews: {
      ...state.reviews,
      [id]: {
        last: now,
        due: now + days * 86400000,
        successes: recalled
          ? Math.min(1000, (previous?.successes || 0) + 1)
          : 0,
      },
    },
  };
}
export function parseState(raw: string | null): SavedState {
  try {
    return raw && raw.length < 12000
      ? validateSavedState(JSON.parse(raw))
      : emptyState();
  } catch {
    return emptyState();
  }
}
export const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("ja").trim().slice(0, 80);
export function filterResources(
  query: string,
  category: string,
  favorites: string[],
  onlyFavorites: boolean,
) {
  const q = normalize(query);
  return resources.filter(
    (x) =>
      (!q || normalize(x.title + " " + x.subtitle + " " + x.tag).includes(q)) &&
      (category === "すべて" || x.category === category) &&
      (!onlyFavorites || favorites.includes(x.id)),
  );
}
