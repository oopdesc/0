import type { StudyFilter } from "./studyPlanner";
import type { ProgressOutcome } from "./progress";

export const STUDY_ROUND_KEY = "0.learning-v2.round.v1";
const questionId = /^(?:java|rust):q[0-9]{4,8}$/;
const topicId = /^(?:java|rust):[A-Za-z0-9._:-]{1,110}$/;
const evidenceLabels: Record<ProgressOutcome, string> = {
  correct: "自力で正答",
  assisted: "手がかりあり・当日再挑戦で正答",
  tentative: "迷いのある正答",
  wrong: "誤答",
  "self-recall": "自己確認",
  "code-passed": "固定テストに合格",
  "code-failed": "実行結果に差分",
  "self-check": "手元で自己確認",
};
export function roundResultLabel(result: ProgressOutcome | null | undefined) {
  return result ? evidenceLabels[result] : "取り組み済み";
}
export type StudyRound = {
  token: string;
  startedAt: number;
  ids: string[];
  outcomes: ("attempted" | "skipped")[];
  filter: StudyFilter;
  purpose?: "application";
  results?: (ProgressOutcome | null)[];
};

export function readStudyFilter(params: URLSearchParams): StudyFilter {
  const language = params.get("lang"), level = params.get("level"), kind = params.get("kind");
  const limit = Number(params.get("limit"));
  const concept = params.get("concept");
  return {
    language: language === "java" || language === "rust" ? language : "all",
    level: level === "beginner" || level === "intermediate" || level === "advanced" ? level : "all",
    kind: kind === "code" || kind === "prediction" ? kind : "all",
    limit: limit === 5 || limit === 20 ? limit : 10,
    includeNew: params.get("new") !== "0",
    ...(concept && topicId.test(concept) ? { concept } : {}),
  };
}

export function todayHref(filter: StudyFilter) {
  const params = new URLSearchParams({ section: "today" });
  if (filter.language !== "all") params.set("lang", filter.language);
  if (filter.level !== "all") params.set("level", filter.level);
  if (filter.kind !== "all") params.set("kind", filter.kind);
  if (filter.limit !== 10) params.set("limit", String(filter.limit));
  if (!filter.includeNew) params.set("new", "0");
  if (filter.concept && topicId.test(filter.concept)) params.set("concept", filter.concept);
  return "/learn?" + params.toString();
}

export function parseStudyRound(raw: string | null): StudyRound | null {
  if (raw === null) return null;
  if (raw.length > 4096) throw Error("学習セットが大きすぎます。");
  const value = JSON.parse(raw) as StudyRound | null;
  if (!value || typeof value !== "object") throw Error("学習セットの形式が不正です。");
  const { token, startedAt, ids, outcomes, filter, purpose, results } = value;
  if (typeof token !== "string" || !/^[a-z0-9-]{8,45}$/.test(token) ||
      !Number.isSafeInteger(startedAt) || startedAt <= 0 ||
      !Array.isArray(ids) || ids.length < 1 || ids.length > 20 ||
      !ids.every(id => typeof id === "string" && questionId.test(id)) ||
      new Set(ids).size !== ids.length ||
      !Array.isArray(outcomes) || outcomes.length > ids.length ||
      !outcomes.every(x => x === "attempted" || x === "skipped") ||
      (purpose !== undefined && purpose !== "application") ||
      (results !== undefined && (!Array.isArray(results) || results.length !== outcomes.length ||
        results.some((result, i) => result !== null && (outcomes[i] !== "attempted" ||
          typeof result !== "string" || !Object.hasOwn(evidenceLabels, result))))) ||
      !filter || !["all", "java", "rust"].includes(filter.language) ||
      !["all", "beginner", "intermediate", "advanced"].includes(filter.level) ||
      !["all", "code", "prediction"].includes(filter.kind) ||
      (filter.concept !== undefined && (typeof filter.concept !== "string" || !topicId.test(filter.concept))) ||
      ![5, 10, 20].includes(filter.limit) || typeof filter.includeNew !== "boolean")
    throw Error("学習セットの内容が不正です。");
  return {
    token, startedAt, ids, outcomes,
    ...(purpose ? { purpose } : {}),
    ...(results ? { results } : {}),
    filter: { language: filter.language, level: filter.level, kind: filter.kind, limit: filter.limit, includeNew: filter.includeNew,
      ...(filter.concept ? { concept: filter.concept } : {}) },
  };
}

export function readStudyRound(): StudyRound | null {
  try { return parseStudyRound(localStorage.getItem(STUDY_ROUND_KEY)); }
  catch { return null; }
}

export function saveStudyRound(round: StudyRound) {
  try { localStorage.setItem(STUDY_ROUND_KEY, JSON.stringify(round)); return true; }
  catch { return false; }
}

export function startStudyRound(ids: string[], filter: StudyFilter, purpose?: StudyRound["purpose"]): StudyRound | null {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length ||
      !ids.every(id => questionId.test(id))) return null;
  const round: StudyRound = {
    token: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
    startedAt: Date.now(), ids, outcomes: [], filter,
    ...(purpose ? { purpose } : {}),
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

export function confirmStudyRoundReplacement(): boolean {
  const active = resumeStudyRound();
  if (!active) return true;
  return window.confirm("進行中の学習セットを置き換えますか？回答と復習の記録は残ります。") &&
    resumeStudyRound() === active;
}
