import type { Alias, Lang } from './types';

export const STORAGE_KEY = '0.learning-v2.state.v1';
export const LAST_KEY = '0.learning-v2.last.v1';
const MAX_BYTES = 1_048_576, MAX_RECORDS = 6000, MAX_DRAFTS = 1000;
const DAY = 86_400_000, INTERVALS = [1, 3, 7, 14, 30];
export type ProgressRecord = { updatedAt: number; blindCorrect: number; assistedCorrect: number; wrong: number; lastAttemptAt: number | null; hintsAt: number | null; solutionAt: number | null; recalls: number; reviewStep: number; dueAt: number | null };
export type Draft = { content: string; updatedAt: number };
export type LegacyEntry = { source: 'academy' | 'practice'; id: string; targetId: string | null; lastAt: number };
export type Progress = { schema: 'zero-learning-progress/1'; records: Record<string, ProgressRecord>; drafts: Record<string, Draft>; legacy: Record<string, LegacyEntry> };
export const emptyProgress = (): Progress => ({ schema: 'zero-learning-progress/1', records: {}, drafts: {}, legacy: {} });
export const recordKey = (id: string, version: string, step: 'prediction' | 'code') => `${id}@${version}#${step}`;
const validKey = (s: string) => /^(?:java|rust):q[0-9]{4,}@[A-Za-z0-9._-]{1,64}#(?:prediction|code)$/.test(s);
const validDraftKey = (s: string) => validKey(s) || /^(?:java|rust):mission-[A-Za-z0-9._-]{1,80}@[A-Za-z0-9._-]{1,64}#file-[0-9]{1,2}$/.test(s);
export const projectDraftKey = (id: string, version: string, fileIndex: number) => `${id}@${version}#file-${fileIndex}`;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const counter = (x: unknown) => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= 1_000_000;
const timestamp = (x: unknown, futureDays = 1) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= Date.now() + futureDays * DAY;
const nullableTime = (x: unknown, futureDays = 1) => x === null || timestamp(x, futureDays);
const legacyId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 120 && !/[\u0000-\u001f]/u.test(x) && !['__proto__', 'prototype', 'constructor'].includes(x);

/** Check input size before parse and reject dangerous keys anywhere in the tree. */
function parseBounded(raw: string): unknown {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('記録ファイルが1MiBを超えています。');
  let data: unknown; try { data = JSON.parse(raw) as unknown; } catch { throw new Error('JSONとして読み取れません。'); }
  let count = 0;
  const inspect = (v: unknown, depth: number) => {
    if (++count > 80_000 || depth > 12) throw new Error('記録の入れ子または件数が上限を超えています。');
    if (!v || typeof v !== 'object') return;
    for (const [key, value] of Object.entries(v)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('危険なプロパティ名が含まれています。');
      inspect(value, depth + 1);
    }
  };
  inspect(data, 0); return data;
}
function parseV2(data: unknown): Progress {
  if (!object(data) || data.schema !== 'zero-learning-progress/1' || !object(data.records) || !object(data.drafts) || !object(data.legacy)) throw new Error('学習記録の形式が違います。');
  if (Object.keys(data.records).length > MAX_RECORDS || Object.keys(data.drafts).length > MAX_DRAFTS || Object.keys(data.legacy).length > MAX_RECORDS) throw new Error('記録の件数が上限を超えています。');
  const result = emptyProgress();
  for (const [key, value] of Object.entries(data.records)) {
    if (!validKey(key) || !object(value) || !timestamp(value.updatedAt) || !counter(value.blindCorrect) || !counter(value.assistedCorrect) || !counter(value.wrong) || !counter(value.recalls) || !Number.isInteger(value.reviewStep) || (value.reviewStep as number) < 0 || (value.reviewStep as number) >= INTERVALS.length || !nullableTime(value.lastAttemptAt) || !nullableTime(value.hintsAt) || !nullableTime(value.solutionAt) || !nullableTime(value.dueAt, 366)) throw new Error(`記録 ${key} が不正です。`);
    result.records[key] = { updatedAt: value.updatedAt as number, blindCorrect: value.blindCorrect as number, assistedCorrect: value.assistedCorrect as number, wrong: value.wrong as number, lastAttemptAt: value.lastAttemptAt as number | null, hintsAt: value.hintsAt as number | null, solutionAt: value.solutionAt as number | null, recalls: value.recalls as number, reviewStep: value.reviewStep as number, dueAt: value.dueAt as number | null };
  }
  for (const [key, value] of Object.entries(data.drafts)) {
    if (!validDraftKey(key) || !object(value) || typeof value.content !== 'string' || new TextEncoder().encode(value.content).byteLength > 65536 || !timestamp(value.updatedAt)) throw new Error(`下書き ${key} が不正です。`);
    result.drafts[key] = { content: value.content, updatedAt: value.updatedAt as number };
  }
  for (const [key, value] of Object.entries(data.legacy)) {
    if (!object(value) || !['academy', 'practice'].includes(String(value.source)) || !legacyId(value.id) || !(value.targetId === null || (typeof value.targetId === 'string' && /^(java|rust):q[0-9]{4,}$/.test(value.targetId))) || !timestamp(value.lastAt) || key !== `${value.source}:${encodeURIComponent(value.id)}`) throw new Error('旧IDの記録が不正です。');
    result.legacy[key] = { source: value.source as 'academy' | 'practice', id: value.id, targetId: value.targetId as string | null, lastAt: value.lastAt as number };
  }
  return result;
}
export function loadProgress(storage: Pick<Storage, 'getItem'>): { state: Progress; writable: boolean; error: string | null } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { state: raw ? parseV2(parseBounded(raw)) : emptyProgress(), writable: true, error: null };
  } catch (e) { return { state: emptyProgress(), writable: false, error: `既存記録を変更していません。${e instanceof Error ? e.message : '保存を読めません。'}` }; }
}
export function saveProgress(storage: Pick<Storage, 'setItem'>, state: Progress): { ok: boolean; error: string | null } {
  try {
    const raw = JSON.stringify(state);
    parseV2(parseBounded(raw));
    storage.setItem(STORAGE_KEY, raw);
    return { ok: true, error: null };
  } catch (e) { return { ok: false, error: `保存できません。既存の保存は削除しません。${e instanceof Error ? e.message : ''}` }; }
}
export function exportProgress(state: Progress): string { return JSON.stringify(state, null, 2); }
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const next: Progress = { schema: current.schema, records: { ...current.records }, drafts: { ...current.drafts }, legacy: { ...current.legacy } };
  for (const [key, value] of Object.entries(incoming.records)) if (!next.records[key] || value.updatedAt > next.records[key].updatedAt) next.records[key] = value;
  for (const [key, value] of Object.entries(incoming.drafts)) if (!next.drafts[key] || value.updatedAt > next.drafts[key].updatedAt) next.drafts[key] = value;
  for (const [key, value] of Object.entries(incoming.legacy)) {
    const old = next.legacy[key];
    if (!old || value.lastAt > old.lastAt) next.legacy[key] = value;
    else if (value.lastAt === old.lastAt && old.targetId === null && value.targetId !== null) next.legacy[key] = { ...old, targetId: value.targetId };
  }
  if (Object.keys(next.records).length > MAX_RECORDS || Object.keys(next.drafts).length > MAX_DRAFTS || Object.keys(next.legacy).length > MAX_RECORDS) throw new Error('統合後の件数が上限を超えます。');
  return next;
}
function legacyFrom(data: unknown, aliases: Alias[]): Progress {
  if (!object(data)) throw new Error('旧記録の形式が違います。');
  const result = emptyProgress();
  const add = (source: 'academy' | 'practice', id: unknown, at: unknown) => {
    if (!legacyId(id) || !timestamp(at)) throw new Error('旧IDまたは日時が不正です。');
    const key = `${source}:${encodeURIComponent(id)}`;
    const matches = aliases.filter(a => a.source === source && a.id === id);
    const targetId = matches.length === 1 ? matches[0].targetId : null;
    const entry: LegacyEntry = { source, id, targetId, lastAt: at as number };
    if (!result.legacy[key] || result.legacy[key].lastAt < entry.lastAt) result.legacy[key] = entry;
  };
  if (data.v === 1 && Array.isArray(data.attempts) && data.attempts.length <= 10_000) {
    for (const attempt of data.attempts) {
      if (!object(attempt) || typeof attempt.ok !== 'boolean') throw new Error('旧問題集の試行が不正です。');
      add('academy', attempt.pid, attempt.at);
    }
  } else if (data.version === 1 && object(data.records) && Object.keys(data.records).length <= MAX_RECORDS) {
    for (const [id, record] of Object.entries(data.records)) {
      if (!object(record) || !counter(record.attempts) || !counter(record.correct) || !counter(record.errorCount)) throw new Error('旧演習の記録が不正です。');
      add('practice', id, record.lastSeen);
    }
  } else throw new Error('対応する記録形式ではありません。');
  return result;
}
export function importProgress(raw: string, current: Progress, aliases: Alias[] = []): { ok: true; state: Progress; legacyOnly: boolean } | { ok: false; error: string } {
  try {
    const data = parseBounded(raw);
    const legacyOnly = !(object(data) && data.schema === 'zero-learning-progress/1');
    const incoming = legacyOnly ? legacyFrom(data, aliases) : parseV2(data);
    return { ok: true, state: mergeProgress(current, incoming), legacyOnly };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : '取り込めません。' }; }
}
const blankRecord = (now: number): ProgressRecord => ({ updatedAt: now, blindCorrect: 0, assistedCorrect: 0, wrong: 0, lastAttemptAt: null, hintsAt: null, solutionAt: null, recalls: 0, reviewStep: 0, dueAt: null });
export function markExposure(state: Progress, key: string, kind: 'hint' | 'solution', now = Date.now()): Progress {
  if (!validKey(key)) return state;
  const previous = state.records[key] ?? blankRecord(now);
  return { ...state, records: { ...state.records, [key]: { ...previous, updatedAt: now, ...(kind === 'hint' ? { hintsAt: previous.hintsAt ?? now } : { solutionAt: previous.solutionAt ?? now }) } } };
}
export function recordPrediction(state: Progress, key: string, ok: boolean, now = Date.now()): Progress {
  if (!validKey(key)) return state;
  const old = state.records[key] ?? blankRecord(now);
  const assisted = old.hintsAt !== null || old.solutionAt !== null;
  const next: ProgressRecord = { ...old, updatedAt: now, lastAttemptAt: now, solutionAt: old.solutionAt ?? now,
    blindCorrect: old.blindCorrect + Number(ok && !assisted), assistedCorrect: old.assistedCorrect + Number(ok && assisted), wrong: old.wrong + Number(!ok), dueAt: now + DAY };
  return { ...state, records: { ...state.records, [key]: next } };
}
export function recordRecall(state: Progress, key: string, now = Date.now()): Progress {
  const old = state.records[key]; if (!old || !old.lastAttemptAt || new Date(old.lastAttemptAt).toDateString() === new Date(now).toDateString()) return state;
  const step = Math.min(old.reviewStep + 1, INTERVALS.length - 1);
  return { ...state, records: { ...state.records, [key]: { ...old, updatedAt: now, lastAttemptAt: now, recalls: old.recalls + 1, reviewStep: step, dueAt: now + INTERVALS[step] * DAY } } };
}
export function saveDraft(state: Progress, key: string, content: string, now = Date.now()): Progress {
  if (!validDraftKey(key) || new TextEncoder().encode(content).byteLength > 65536) return state;
  return { ...state, drafts: { ...state.drafts, [key]: { content, updatedAt: now } } };
}
export function saveLast(storage: Pick<Storage, 'setItem'>, language: Lang, id: string): void {
  if (!new RegExp(`^${language}:q[0-9]{4,}$`).test(id)) return;
  try { storage.setItem(LAST_KEY, JSON.stringify({ language, id })); } catch { /* progress warning is shown separately */ }
}
export function loadLast(storage: Pick<Storage, 'getItem'>): { language: Lang; id: string } | null {
  try { const raw = storage.getItem(LAST_KEY); if (!raw || raw.length > 200) return null; const x: unknown = JSON.parse(raw); return object(x) && (x.language === 'java' || x.language === 'rust') && typeof x.id === 'string' && new RegExp(`^${x.language}:q[0-9]{4,}$`).test(x.id) ? { language: x.language, id: x.id } : null; } catch { return null; }
}
