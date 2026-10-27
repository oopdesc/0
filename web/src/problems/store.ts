import type { Language, Problem } from "./schema";
import { normaliseAnswer } from "./schema";

/**
 * Browser-local learning record. No account, no server, no analytics:
 * the store lives in localStorage and every mutation is explicit.
 *
 * Status buckets (requirement 13):
 *   unlearned      未学習
 *   learning       学習中
 *   answered       正答したが未定着
 *   review         復習期限
 *   reproduced     再現成功
 *   transferred    類題成功
 *   weak           苦手概念
 *   recent-error   最近の誤差
 */

export type LearnStatus =
  | "unlearned"
  | "learning"
  | "answered"
  | "reproduced"
  | "transferred"
  | "weak";

export type ProgressBucket =
  | "unlearned"
  | "learning"
  | "answered"
  | "review"
  | "reproduced"
  | "transferred"
  | "weak"
  | "recent-error";

export const BUCKET_LABEL: Record<ProgressBucket, string> = {
  unlearned: "未学習",
  learning: "学習中",
  answered: "正答したが未定着",
  review: "復習期限",
  reproduced: "再現成功",
  transferred: "類題成功",
  weak: "苦手概念",
  "recent-error": "最近の誤差",
};

export const BUCKET_ORDER: ProgressBucket[] = [
  "review",
  "weak",
  "recent-error",
  "learning",
  "answered",
  "reproduced",
  "transferred",
  "unlearned",
];

export interface Attempt {
  at: number;
  prediction: string;
  actual: string;
  ok: boolean;
  /** Predicted before reveal, or empty when the learner revealed first. */
  blind: boolean;
}

export interface ProblemRecord {
  id: string;
  status: LearnStatus;
  attempts: number;
  correct: number;
  errorCount: number;
  lastSeen: number;
  lastAnswered: number | null;
  lastReproduced: number | null;
  lastErrorAt: number | null;
  lastTransfer: number | null;
  reviewDueAt: number | null;
  reviewInterval: number;
  streak: number;
  misconceptions: string[];
  patches: string[];
  history: Attempt[];
}

export interface ProgressSettings {
  /** Days between retrieval attempts. Adjustable by the learner. */
  intervals: number[];
  /** Show the transfer problem after a correct reproduction. */
  transferAfterReproduce: boolean;
  /** Number of blind reproductions required before a problem counts as learned. */
  reproduceTarget: number;
}

export interface ProgressState {
  version: 1;
  records: Record<string, ProblemRecord>;
  settings: ProgressSettings;
}

const KEY = "cosmic.problems.progress.v1";
const HISTORY_LIMIT = 24;

export const DEFAULT_SETTINGS: ProgressSettings = {
  intervals: [1, 3, 7, 14, 30],
  transferAfterReproduce: true,
  reproduceTarget: 1,
};

function emptyRecord(problem: Problem, now: number): ProblemRecord {
  return {
    id: problem.id,
    status: "unlearned",
    attempts: 0,
    correct: 0,
    errorCount: 0,
    lastSeen: now,
    lastAnswered: null,
    lastReproduced: null,
    lastErrorAt: null,
    lastTransfer: null,
    reviewDueAt: null,
    reviewInterval: problem.reviewInterval,
    streak: 0,
    misconceptions: [],
    patches: [],
    history: [],
  };
}

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: 1, records: {}, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    if (!parsed || typeof parsed !== "object" || !parsed.records) {
      return { version: 1, records: {}, settings: { ...DEFAULT_SETTINGS } };
    }
    return {
      version: 1,
      records: parsed.records as Record<string, ProblemRecord>,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { version: 1, records: {}, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function saveProgress(state: ProgressState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the app keeps working for this session */
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/* --------------------------------------------------------- export / import */

/**
 * The learner's record is browser-local, but a record worth keeping should be
 * portable: backup, another browser, another machine. Export is a plain JSON file
 * with no credentials and — deliberately — none of the learner's written answers,
 * so a backup file never carries free-form text into a different browser.
 */
const EXPORT_APPLICATION = "cosmic-problems-progress";
const EXPORT_VERSION = 1;
const EXPORT_SCHEMA = 1;
const MAX_EXPORT_CHARACTERS = 2_000_000;
const EXPORT_STATUSES: ReadonlySet<string> = new Set([
  "unlearned",
  "learning",
  "answered",
  "reproduced",
  "transferred",
  "weak",
]);

function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normaliseAttempt(value: unknown): Attempt | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const at = nonNegative(v.at);
  if (at === null) return null;
  return { at, prediction: "", actual: "", ok: v.ok === true, blind: v.blind === true };
}

/**
 * Validate one record. Returns `null` for anything that is not a well-formed
 * record, so a hand-edited or hostile file cannot smuggle bad counters in.
 */
export function normaliseRecord(
  id: string,
  value: unknown,
  now: number,
): ProblemRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id !== id) return null;
  const attempts = nonNegative(v.attempts);
  if (attempts === null) return null;
  const rawStatus = typeof v.status === "string" ? v.status : null;
  if (rawStatus === null || !EXPORT_STATUSES.has(rawStatus)) return null;
  const correct = nonNegative(v.correct);
  const errorCount = nonNegative(v.errorCount);
  const streak = nonNegative(v.streak);
  if (correct === null || errorCount === null || streak === null) return null;
  if (!Array.isArray(v.history)) return null;
  const history: Attempt[] = [];
  for (const item of v.history) {
    const attempt = normaliseAttempt(item);
    if (!attempt) return null;
    history.push(attempt);
  }
  if (!Array.isArray(v.misconceptions) || !v.misconceptions.every((m) => typeof m === "string")) {
    return null;
  }
  if (!Array.isArray(v.patches) || !v.patches.every((p) => typeof p === "string")) return null;
  return {
    id,
    status: rawStatus as LearnStatus,
    attempts,
    correct,
    errorCount,
    lastSeen: finiteOrNull(v.lastSeen) ?? now,
    lastAnswered: finiteOrNull(v.lastAnswered),
    lastReproduced: finiteOrNull(v.lastReproduced),
    lastErrorAt: finiteOrNull(v.lastErrorAt),
    lastTransfer: finiteOrNull(v.lastTransfer),
    reviewDueAt: finiteOrNull(v.reviewDueAt),
    reviewInterval: nonNegative(v.reviewInterval) ?? 1,
    streak,
    misconceptions: [...(v.misconceptions as string[])],
    patches: [...(v.patches as string[])],
    history,
  };
}

export function exportProgressJson(state: ProgressState): string {
  const records: Record<string, unknown> = {};
  for (const [id, record] of Object.entries(state.records)) {
    records[id] = {
      ...record,
      history: record.history.map((attempt) => ({
        at: attempt.at,
        ok: attempt.ok,
        blind: attempt.blind,
      })),
    };
  }
  return JSON.stringify(
    {
      application: EXPORT_APPLICATION,
      version: EXPORT_VERSION,
      data: { schema: EXPORT_SCHEMA, records, settings: state.settings },
    },
    null,
    2,
  );
}

/**
 * Reject anything that is not a file this site wrote. An invalid file raises
 * instead of silently becoming an empty record: an empty record would quietly
 * look like "you have learned nothing" and destroy the learner's progress.
 */
export function importProgressJson(
  raw: string,
  options: { now?: number; knownIds?: ReadonlySet<string> } = {},
): ProgressState {
  const now = options.now ?? Date.now();
  if (raw.length > MAX_EXPORT_CHARACTERS) throw Error("記録ファイルが大きすぎます。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Error("JSON の記録ファイルを選んでください。");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { application?: unknown }).application !== EXPORT_APPLICATION ||
    (parsed as { version?: unknown }).version !== EXPORT_VERSION
  ) {
    throw Error("このサイトから書き出した学習記録を選んでください。");
  }
  const data = (parsed as { data?: unknown }).data;
  if (
    !data ||
    typeof data !== "object" ||
    (data as { schema?: unknown }).schema !== EXPORT_SCHEMA
  ) {
    throw Error("このサイトから書き出した学習記録を選んでください。");
  }
  const source = (data as { records?: unknown }).records;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw Error("学習記録の形式が違います。");
  }
  const records: Record<string, ProblemRecord> = {};
  for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
    if (options.knownIds && !options.knownIds.has(id)) continue;
    const record = normaliseRecord(id, value, now);
    if (record) records[id] = record;
  }
  const settings = (data as { settings?: unknown }).settings;
  return {
    version: 1,
    records,
    settings:
      settings && typeof settings === "object"
        ? { ...DEFAULT_SETTINGS, ...(settings as Partial<ProgressSettings>) }
        : { ...DEFAULT_SETTINGS },
  };
}

/**
 * Merge an imported record into the current one. The more recent record wins per
 * problem, so importing an old backup never overwrites newer progress. Settings
 * stay as the current browser has them.
 */
export function mergeProgress(
  current: ProgressState,
  incoming: ProgressState,
  now = Date.now(),
): ProgressState {
  const records: Record<string, ProblemRecord> = { ...current.records };
  for (const [id, record] of Object.entries(incoming.records)) {
    const existing = records[id];
    if (!existing || (record.lastSeen ?? 0) >= (existing.lastSeen ?? 0)) {
      records[id] = {
        ...record,
        lastSeen: Math.max(record.lastSeen ?? 0, existing?.lastSeen ?? 0, now),
      };
    }
  }
  return { version: 1, records, settings: { ...current.settings } };
}

function clone(state: ProgressState): ProgressState {
  return { ...state, records: { ...state.records }, settings: { ...state.settings } };
}

/**
 * Return a new state plus the record that was touched, and persist it.
 * Callers render from the returned state so React sees the change.
 */
export function withRecord(
  state: ProgressState,
  problem: Problem,
  mutate: (record: ProblemRecord, now: number) => ProblemRecord,
): { state: ProgressState; record: ProblemRecord } {
  const now = Date.now();
  const next = clone(state);
  const record: ProblemRecord = next.records[problem.id]
    ? { ...next.records[problem.id]!, lastSeen: now }
    : emptyRecord(problem, now);
  next.records[problem.id] = mutate(record, now);
  saveProgress(next);
  return { state: next, record: next.records[problem.id]! };
}

/** Blind reproduction counts as learning; reading the explanation does not. */
export function isLearned(record: ProblemRecord | undefined): boolean {
  return !!record && record.status === "reproduced" || !!record && record.status === "transferred";
}

export function isBlind(record: ProblemRecord): boolean {
  return record.attempts > 0 && record.history.some((h) => h.blind && h.ok);
}

export function nextReviewDue(record: ProblemRecord, successes: number, now: number): number {
  const intervals = [1, 3, 7, 14, 30];
  const index = Math.min(successes, intervals.length - 1);
  const days = intervals[index]! * Math.max(1, record.reviewInterval / 2 || 1);
  return now + days * 86_400_000;
}

/** Roll the review interval forward by one step when a retrieval succeeds. */
export function scheduleReview(
  record: ProblemRecord,
  successes: number,
  now: number,
): void {
  const intervals = [1, 3, 7, 14, 30];
  const days = intervals[Math.min(successes, intervals.length - 1)]!;
  record.reviewInterval = Math.max(1, record.reviewInterval);
  record.reviewDueAt = now + days * 86_400_000;
}

export function applyAttempt(
  state: ProgressState,
  problem: Problem,
  input: { prediction: string; actual: string; ok: boolean; blind: boolean },
): { state: ProgressState; record: ProblemRecord } {
  return withRecord(state, problem, (record, now) => {
  record.attempts += 1;
  record.history.push({ at: now, ...input });
  if (record.history.length > HISTORY_LIMIT) {
    record.history.splice(0, record.history.length - HISTORY_LIMIT);
  }
  record.lastSeen = now;

  if (input.ok) {
    record.correct += 1;
    record.streak += 1;
    record.errorCount = 0;
    record.lastAnswered = now;
    if (input.blind) {
      record.lastReproduced = now;
      record.status = "reproduced";
      scheduleReview(record, record.streak, now);
    } else if (record.status !== "reproduced" && record.status !== "transferred") {
      record.status = "answered";
    }
    if (!record.patches.includes(problem.oneLinePatch)) {
      record.patches.push(problem.oneLinePatch);
    }
  } else {
    record.errorCount += 1;
    record.streak = 0;
    record.lastErrorAt = now;
    if (record.status === "reproduced" || record.status === "transferred") {
      record.status = "answered";
      record.reviewDueAt = now;
    } else if (record.status !== "weak" && record.errorCount >= 2) {
      record.status = "weak";
    } else if (record.status === "unlearned") {
      record.status = "learning";
    }
    if (!record.misconceptions.includes(problem.misconceptionClass)) {
      record.misconceptions.push(problem.misconceptionClass);
    }
  }
  return record;
  });
}

/** Mark a transfer problem as answered. */
export function applyTransfer(
  state: ProgressState,
  problem: Problem,
  ok: boolean,
  blind: boolean,
): { state: ProgressState; record: ProblemRecord } {
  return withRecord(state, problem, (record, now) => {
  record.lastTransfer = now;
  record.attempts += 1;
  if (ok) {
    record.correct += 1;
    record.status = "transferred";
    record.lastReproduced = now;
    record.reviewDueAt = null;
  } else {
    record.errorCount += 1;
    record.status = "weak";
    record.lastErrorAt = now;
    if (!record.misconceptions.includes(problem.misconceptionClass)) {
      record.misconceptions.push(problem.misconceptionClass);
    }
  }
  void blind;
  return record;
  });
}

export interface BucketCount {
  bucket: ProgressBucket;
  count: number;
}

/** Assign one bucket per problem, using the review clock and recent errors. */
export function bucketFor(problem: Problem, record: ProblemRecord | undefined, now: number): ProgressBucket {
  void problem;
  if (!record || record.attempts === 0) return "unlearned";
  if (record.status === "weak" && record.errorCount > 0) return "weak";
  if (record.lastErrorAt && now - record.lastErrorAt < 2 * 86_400_000 && record.errorCount > 0) {
    return "recent-error";
  }
  if (record.reviewDueAt && record.reviewDueAt <= now && record.status !== "reproduced" && record.status !== "transferred") {
    return "review";
  }
  return record.status as ProgressBucket;
}

export function bucketCounts(
  problems: Problem[],
  state: ProgressState,
  now: number,
): BucketCount[] {
  const counts: Record<ProgressBucket, number> = {
    unlearned: 0,
    learning: 0,
    answered: 0,
    review: 0,
    reproduced: 0,
    transferred: 0,
    weak: 0,
    "recent-error": 0,
  };
  for (const problem of problems) {
    const record = state.records[problem.id];
    counts[bucketFor(problem, record, now)] += 1;
  }
  return BUCKET_ORDER.map((bucket) => ({ bucket, count: counts[bucket] }));
}

/**
 * Compose the day's problems.
 *
 * The learner should never have to decide what to study next. This builds a set
 * of five from the four states that matter most, in a fixed ratio:
 *
 *   due reviews x2  - closest deadlines first, so the backlog drains
 *   weak concept x1 - problems stuck in the weak bucket, most recent error first
 *   new problem x1  - first unlearned problem in curriculum order
 *   transfer x1     - a problem whose whole point is blind reproduction
 *
 * Anything missing falls back to the next best state, so the set is always full
 * when at least five problems exist. Deterministic for a given state: opening the
 * page twice shows the same five.
 */
export type TodayReason = "due" | "weak" | "new" | "transfer" | "queue";

export const TODAY_REASON_LABEL: Record<TodayReason, string> = {
  due: "復習期限",
  weak: "苦手概念",
  new: "新規",
  transfer: "転移",
  queue: "次",
};

export interface TodaySetItem {
  problem: Problem;
  reason: TodayReason;
}

/** Curriculum order: topic grouping first, then id, so "new" is stable. */
function byCurriculum(a: Problem, b: Problem): number {
  return a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id);
}

function errorFirst(a: Problem, b: Problem, state: ProgressState): number {
  const ra = state.records[a.id];
  const rb = state.records[b.id];
  return (rb?.lastErrorAt ?? 0) - (ra?.lastErrorAt ?? 0) || byCurriculum(a, b);
}

export function buildTodaySet(
  problems: Problem[],
  state: ProgressState,
  now: number,
  count = 5,
): TodaySetItem[] {
  const items: TodaySetItem[] = [];
  const seen = new Set<string>();
  const take = (reason: TodayReason, want: number, pick: Problem[]) => {
    let added = 0;
    for (const problem of pick) {
      if (added >= want) break;
      if (!problem || seen.has(problem.id)) continue;
      seen.add(problem.id);
      items.push({ problem, reason });
      added += 1;
    }
  };

  // 1. due reviews (up to two), closest deadline first
  take("due", 2, problems
    .filter((p) => bucketFor(p, state.records[p.id], now) === "review")
    .sort((a, b) => {
      const ra = state.records[a.id];
      const rb = state.records[b.id];
      return (ra?.reviewDueAt ?? 0) - (rb?.reviewDueAt ?? 0) || byCurriculum(a, b);
    }));

  // 2. the one weak concept that most needs attention
  take("weak", 1, problems
    .filter((p) => bucketFor(p, state.records[p.id], now) === "weak")
    .sort((a, b) => errorFirst(a, b, state)));

  // 3. the next new problem, in curriculum order
  take("new", 1, problems
    .filter((p) => bucketFor(p, state.records[p.id], now) === "unlearned")
    .sort(byCurriculum));

  // 4. blind reproduction: a problem already reproduced, soonest to lose it
  take("transfer", 1, problems
    .filter((p) => bucketFor(p, state.records[p.id], now) === "reproduced" || bucketFor(p, state.records[p.id], now) === "transferred")
    .sort((a, b) => {
      const ra = state.records[a.id];
      const rb = state.records[b.id];
      return (ra?.lastReproduced ?? 0) - (rb?.lastReproduced ?? 0) || byCurriculum(a, b);
    }));

  // 5. fill from whatever remains, most-review-urgent first
  if (items.length < count) {
    take("queue", count - items.length, problems
      .filter((p) => !seen.has(p.id))
      .sort((a, b) => {
        const ra = state.records[a.id];
        const rb = state.records[b.id];
        const urgency = (r: ProblemRecord | undefined) => {
          if (!r || r.attempts === 0) return 0;
          return r.errorCount * 2 + (r.reviewDueAt && r.reviewDueAt <= now ? 4 : 0) + (r.lastErrorAt && now - r.lastErrorAt < 2 * 86_400_000 ? 1 : 0);
        };
        return urgency(rb) - urgency(ra) || byCurriculum(a, b);
      }));
  }

  return items.slice(0, count);
}

export function shouldReview(problem: Problem, state: ProgressState, now: number): boolean {
  const record = state.records[problem.id];
  void problem;
  if (!record || record.attempts === 0) return false;
  if (record.reviewDueAt === null) return false;
  return record.reviewDueAt <= now;
}

export function normalise(s: string): string {
  return normaliseAnswer(s);
}

export type { Language };
