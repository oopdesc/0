/**
 * Local, account-free progress. Every read is validated and rebuilt from a
 * whitelist so malformed imports, prototype-pollution keys or oversized data
 * can never reach the rest of the app.
 */
import type { Dialect } from '../lang';
import type { ReviewCard } from '../learning/srs';
import type { Patch } from '../learning/patches';

export const STORAGE_KEY = 'orrery.progress.v2';
export const MAX_IMPORT_BYTES = 256 * 1024;

export type Quality = 'auto' | 'high' | 'balanced' | 'battery';
export type Theme = 'dark' | 'light';

export interface Preferences {
  theme: Theme;
  quality: Quality;
  reducedMotion: boolean;
  timeScale: number;
  dialect: Dialect;
  showGrid: boolean;
  audioOff: boolean;
}

export interface Attempt {
  count: number;
  last: 'pass' | 'fail' | 'none';
  prediction: string;
  actual: string;
  at: number;
}

export interface ProgressState {
  version: 2;
  completed: Record<string, number>;
  stages: Record<string, number>;
  patches: Patch[];
  review: Record<string, ReviewCard>;
  favorites: string[];
  attempts: Record<string, Attempt>;
  preferences: Preferences;
  lastLesson: string;
  totalRuns: number;
  updatedAt: number;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function safeKey(k: unknown): string | null {
  if (typeof k !== 'string' || k.length === 0 || k.length > 120) return null;
  if (FORBIDDEN_KEYS.has(k)) return null;
  return k;
}

function safeNumber(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringRecord(v: unknown, valueMapper: (x: unknown) => unknown, limit = 500): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (!isRecord(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v)) {
    if (n++ >= limit) break;
    const key = safeKey(k);
    if (!key) continue;
    out[key] = valueMapper(val);
  }
  return out;
}

export function defaultProgress(now = Date.now()): ProgressState {
  return {
    version: 2,
    completed: {},
    stages: {},
    patches: [],
    review: {},
    favorites: [],
    attempts: {},
    preferences: {
      theme: 'light', quality: 'balanced', reducedMotion: false, timeScale: 1,
      dialect: 'java', showGrid: true, audioOff: true,
    },
    lastLesson: '',
    totalRuns: 0,
    updatedAt: now,
  };
}

function sanitiseCard(v: unknown, id: string, now: number): ReviewCard | null {
  if (!isRecord(v)) return null;
  return {
    id,
    due: safeNumber(v.due, now, 0, now + 10 * 365 * 86400000),
    interval: safeNumber(v.interval, 0, 0, 3650),
    ease: safeNumber(v.ease, 2.5, 1.3, 2.8),
    reps: safeNumber(v.reps, 0, 0, 100000),
    lapses: safeNumber(v.lapses, 0, 0, 100000),
    lastReviewed: safeNumber(v.lastReviewed, 0, 0, now + 86400000),
  };
}

function sanitisePatch(v: unknown): Patch | null {
  if (!isRecord(v) || typeof v.text !== 'string' || v.text.length > 180) return null;
  return {
    id: typeof v.id === 'string' && v.id.length < 100 ? v.id : 'p-import',
    text: v.text.slice(0, 180),
    concept: typeof v.concept === 'string' ? v.concept.slice(0, 80) : '',
    source: typeof v.source === 'string' ? v.source.slice(0, 120) : '',
    createdAt: safeNumber(v.createdAt, Date.now(), 0, Date.now() + 86400000),
  };
}

/** Rebuild a fully valid state from arbitrary untrusted JSON. */
export function sanitiseProgress(raw: unknown, now = Date.now()): ProgressState {
  const base = defaultProgress(now);
  if (!isRecord(raw)) return base;
  const prefs = isRecord(raw.preferences) ? raw.preferences : {};
  const theme: Theme = prefs.theme === 'light' ? 'light' : 'dark';
  const quality: Quality = ['auto', 'high', 'balanced', 'battery'].includes(String(prefs.quality))
    ? (prefs.quality as Quality) : 'auto';

  const completed: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [k, v] of Object.entries(stringRecord(raw.completed, (x) => safeNumber(x, now, 0, now + 86400000)))) {
    completed[k] = v as number;
  }
  const stages: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [k, v] of Object.entries(stringRecord(raw.stages, (x) => safeNumber(x, 0, 0, 100)))) {
    stages[k] = v as number;
  }
  const review: Record<string, ReviewCard> = Object.create(null) as Record<string, ReviewCard>;
  for (const [k, v] of Object.entries(stringRecord(raw.review, (x) => x, 1000))) {
    const card = sanitiseCard(v, k, now);
    if (card) review[k] = card;
  }
  const attempts: Record<string, Attempt> = Object.create(null) as Record<string, Attempt>;
  for (const [k, v] of Object.entries(stringRecord(raw.attempts, (x) => x, 1000))) {
    if (!isRecord(v)) continue;
    attempts[k] = {
      count: safeNumber(v.count, 0, 0, 100000),
      last: v.last === 'pass' || v.last === 'fail' ? v.last : 'none',
      prediction: typeof v.prediction === 'string' ? v.prediction.slice(0, 400) : '',
      actual: typeof v.actual === 'string' ? v.actual.slice(0, 400) : '',
      at: safeNumber(v.at, 0, 0, now + 86400000),
    };
  }

  return {
    version: 2,
    completed,
    stages,
    patches: Array.isArray(raw.patches)
      ? raw.patches.slice(0, 300).map(sanitisePatch).filter((p): p is Patch => p !== null)
      : [],
    review,
    favorites: Array.isArray(raw.favorites)
      ? [...new Set(raw.favorites.filter((x): x is string => typeof x === 'string' && x.length < 120))].slice(0, 200)
      : [],
    attempts,
    preferences: {
      theme,
      quality,
      reducedMotion: prefs.reducedMotion === true || prefs.reducedMotion === 'true',
      timeScale: safeNumber(prefs.timeScale, 1, 0.1, 4),
      dialect: prefs.dialect === 'rust' ? 'rust' : 'java',
      showGrid: prefs.showGrid !== false,
      audioOff: prefs.audioOff !== false,
    },
    lastLesson: typeof raw.lastLesson === 'string' ? raw.lastLesson.slice(0, 120) : '',
    totalRuns: safeNumber(raw.totalRuns, 0, 0, 10_000_000),
    updatedAt: safeNumber(raw.updatedAt, now, 0, now + 86400000),
  };
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProgress(storage?: Storage, now = Date.now()): ProgressState {
  const s = getStorage(storage);
  if (!s) return defaultProgress(now);
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_IMPORT_BYTES) return defaultProgress(now);
    return sanitiseProgress(JSON.parse(raw) as unknown, now);
  } catch {
    return defaultProgress(now);
  }
}

export function saveProgress(state: ProgressState, storage?: Storage): boolean {
  const s = getStorage(storage);
  if (!s) return false;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function exportProgress(state: ProgressState): string {
  return JSON.stringify(state, null, 2);
}

export function importProgress(json: string, now = Date.now()): { ok: boolean; state?: ProgressState; error?: string } {
  if (typeof json !== 'string' || json.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'データが大きすぎます（256KB まで）' };
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return { ok: true, state: sanitiseProgress(parsed, now) };
  } catch {
    return { ok: false, error: 'JSON として読み取れません' };
  }
}

export function markComplete(state: ProgressState, challengeId: string, lessonId: string, stage: number, now = Date.now()): ProgressState {
  return {
    ...state,
    completed: { ...state.completed, [challengeId]: now },
    stages: { ...state.stages, [lessonId]: Math.max(state.stages[lessonId] ?? 0, stage) },
    lastLesson: lessonId,
    updatedAt: now,
  };
}

export function recordAttempt(state: ProgressState, id: string, prediction: string, actual: string, passed: boolean, now = Date.now()): ProgressState {
  const prev = state.attempts[id] ?? { count: 0, last: 'none' as const, prediction: '', actual: '', at: 0 };
  return {
    ...state,
    attempts: {
      ...state.attempts,
      [id]: { count: prev.count + 1, last: passed ? 'pass' : 'fail', prediction: prediction.slice(0, 400), actual: actual.slice(0, 400), at: now },
    },
    totalRuns: state.totalRuns + 1,
    updatedAt: now,
  };
}
