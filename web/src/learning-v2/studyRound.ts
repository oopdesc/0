import type { StudyFilter } from "./studyPlanner";

const KEY = "0.learning-v2.round.v1";
const questionId = /^(?:java|rust):q[0-9]{4,8}$/;
export type StudyRound = {
  token: string;
  startedAt: number;
  ids: string[];
  outcomes: ("attempted" | "skipped")[];
  filter: StudyFilter;
};

export function readStudyFilter(params: URLSearchParams): StudyFilter {
  const language = params.get("lang"), level = params.get("level"), kind = params.get("kind");
  const limit = Number(params.get("limit"));
  return {
    language: language === "java" || language === "rust" ? language : "all",
    level: level === "beginner" || level === "intermediate" || level === "advanced" ? level : "all",
    kind: kind === "code" || kind === "prediction" ? kind : "all",
    limit: limit === 5 || limit === 20 ? limit : 10,
    includeNew: params.get("new") !== "0",
  };
}

export function todayHref(filter: StudyFilter) {
  const params = new URLSearchParams({ section: "today" });
  if (filter.language !== "all") params.set("lang", filter.language);
  if (filter.level !== "all") params.set("level", filter.level);
  if (filter.kind !== "all") params.set("kind", filter.kind);
  if (filter.limit !== 10) params.set("limit", String(filter.limit));
  if (!filter.includeNew) params.set("new", "0");
  return "/learn?" + params.toString();
}

export function readStudyRound(): StudyRound | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 4096) return null;
    const value: StudyRound = JSON.parse(raw);
    const {token, startedAt, ids, outcomes, filter} = value;
    if (typeof token !== "string" || !/^[a-z0-9-]{8,45}$/.test(token) ||
        !Number.isSafeInteger(startedAt) || startedAt <= 0 ||
        !Array.isArray(ids) || ids.length < 1 || ids.length > 20 ||
        !ids.every(id => typeof id === "string" && questionId.test(id)) ||
        new Set(ids).size !== ids.length ||
        !Array.isArray(outcomes) || outcomes.length > ids.length ||
        !outcomes.every(x => x === "attempted" || x === "skipped") ||
        !filter || !["all", "java", "rust"].includes(filter.language) ||
        !["all", "beginner", "intermediate", "advanced"].includes(filter.level) ||
        !["all", "code", "prediction"].includes(filter.kind) ||
        ![5, 10, 20].includes(filter.limit) || typeof filter.includeNew !== "boolean") return null;
    return value;
  } catch { return null; }
}

export function saveStudyRound(round: StudyRound) {
  try { localStorage.setItem(KEY, JSON.stringify(round)); return true; }
  catch { return false; }
}

export function startStudyRound(ids: string[], filter: StudyFilter): StudyRound | null {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length ||
      !ids.every(id => questionId.test(id))) return null;
  const round = {
    token: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
    startedAt: Date.now(), ids, outcomes: [], filter,
  };
  return saveStudyRound(round) ? round : null;
}

export function roundHref(round: StudyRound) {
  const id = round.ids[round.outcomes.length];
  if (!id) return todayHref(round.filter);
  return "/learn?" + new URLSearchParams({
    section: "drill", lang: id.startsWith("rust:") ? "rust" : "java", q: id, study: round.token,
  }).toString();
}

export function resumeStudyRound(): string | null {
  const round = readStudyRound();
  return round && round.outcomes.length < round.ids.length ? roundHref(round) : null;
}
