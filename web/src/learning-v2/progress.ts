import type { Alias, Lang } from './types';

export const STORAGE_KEY = '0.learning-v2.state.v1';
export const LAST_KEY = '0.learning-v2.last.v1';
const MAX_BYTES = 1_048_576, MAX_RECORDS = 6000, MAX_DRAFTS = 1000;
const DAY = 86_400_000, INTERVALS = [1, 3, 7, 14, 30];
export type ProgressOutcome = 'correct'|'assisted'|'tentative'|'wrong'|'self-recall'|'code-passed'|'code-failed'|'self-check';
type DelayedPrediction = { at: number; outcome: 'correct' | 'tentative' | 'wrong' };
type ApplicationResult = { at: number; outcome: Exclude<ProgressOutcome, 'self-recall'> };
export type ProgressRecord = { updatedAt: number; blindCorrect: number; assistedCorrect: number; wrong: number; lastAttemptAt: number | null; hintsAt: number | null; solutionAt: number | null; recalls: number; reviewStep: number; dueAt: number | null; codePasses?:number; codeFailures?:number; manualCodeChecks?:number; lastOutcome?:ProgressOutcome; firstCorrectAt?:number; delayed?:DelayedPrediction; application?:ApplicationResult };
export type Draft = { content: string; updatedAt: number };
export type LegacyEntry = { source: 'academy' | 'practice'; id: string; targetId: string | null; lastAt: number };
export type Progress = { schema: 'zero-learning-progress/1'; records: Record<string, ProgressRecord>; drafts: Record<string, Draft>; legacy: Record<string, LegacyEntry> };
export const emptyProgress = (): Progress => ({ schema: 'zero-learning-progress/1', records: {}, drafts: {}, legacy: {} });
export const recordKey = (id: string, version: string, step: 'prediction' | 'code') => `${id}@${version}#${step}`;
const validKey = (s: string) => /^(?:java|rust):(?:q[0-9]{4,}|[A-Za-z0-9_-]{1,80}:q[0-9]{1,8})@[A-Za-z0-9._-]{1,64}#(?:prediction|code)$/.test(s);
const validDraftKey = (s: string) => validKey(s) || /^(?:java|rust):mission-[A-Za-z0-9._-]{1,80}@[A-Za-z0-9._-]{1,64}#file-[0-9]{1,2}$/.test(s);
export const projectDraftKey = (id: string, version: string, fileIndex: number) => `${id}@${version}#file-${fileIndex}`;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const counter = (x: unknown) => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= 1_000_000;
const timestamp = (x: unknown, futureDays = 1) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= Date.now() + futureDays * DAY;
const nullableTime = (x: unknown, futureDays = 1) => x === null || timestamp(x, futureDays);
const outcomes = ['correct','assisted','tentative','wrong','self-recall','code-passed','code-failed','self-check'];
function applicationOutcome(key: string, outcome: unknown): outcome is ApplicationResult['outcome'] {
  return key.endsWith('#code')
    ? outcome === 'code-passed' || outcome === 'code-failed' || outcome === 'self-check'
    : outcome === 'correct' || outcome === 'assisted' || outcome === 'tentative' || outcome === 'wrong';
}
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
    if (!validKey(key) || !object(value) || !timestamp(value.updatedAt) || !counter(value.blindCorrect) || !counter(value.assistedCorrect) || !counter(value.wrong) || !counter(value.recalls) || !Number.isInteger(value.reviewStep) || (value.reviewStep as number) < 0 || (value.reviewStep as number) >= INTERVALS.length || !nullableTime(value.lastAttemptAt) || !nullableTime(value.hintsAt) || !nullableTime(value.solutionAt) || !nullableTime(value.dueAt, 366) || !['codePasses','codeFailures','manualCodeChecks'].every(k=>value[k]===undefined||counter(value[k])) || !(value.lastOutcome===undefined||outcomes.includes(String(value.lastOutcome)))) throw new Error(`記録 ${key} が不正です。`);
    result.records[key] = { updatedAt: value.updatedAt as number, blindCorrect: value.blindCorrect as number, assistedCorrect: value.assistedCorrect as number, wrong: value.wrong as number, lastAttemptAt: value.lastAttemptAt as number | null, hintsAt: value.hintsAt as number | null, solutionAt: value.solutionAt as number | null, recalls: value.recalls as number, reviewStep: value.reviewStep as number, dueAt: value.dueAt as number | null, ...(value.codePasses!==undefined?{codePasses:value.codePasses as number}:{}), ...(value.codeFailures!==undefined?{codeFailures:value.codeFailures as number}:{}), ...(value.manualCodeChecks!==undefined?{manualCodeChecks:value.manualCodeChecks as number}:{}), ...(value.lastOutcome!==undefined?{lastOutcome:value.lastOutcome as ProgressRecord['lastOutcome']}:{}) };
    if (value.firstCorrectAt !== undefined) {
      if (!key.endsWith('#prediction') || !timestamp(value.firstCorrectAt) || result.records[key].lastAttemptAt === null ||
          (value.firstCorrectAt as number) > result.records[key].lastAttemptAt! || !result.records[key].blindCorrect)
        throw Error("初回の自力正答の日時が不正です。");
      result.records[key].firstCorrectAt = value.firstCorrectAt as number;
    }
    if (value.delayed !== undefined) {
      const entry = value.delayed;
      if (!key.endsWith('#prediction') || !object(entry) || !timestamp(entry.at) ||
          result.records[key].lastAttemptAt === null || (entry.at as number) > result.records[key].lastAttemptAt! ||
          (entry.outcome !== 'correct' && entry.outcome !== 'tentative' && entry.outcome !== 'wrong'))
        throw Error("日を空けた復習の記録が不正です。");
      result.records[key].delayed = { at: entry.at as number, outcome: entry.outcome };
    }
    if (value.application !== undefined) {
      const entry = value.application;
      if (!object(entry) || !timestamp(entry.at) || result.records[key].lastAttemptAt === null ||
          (entry.at as number) > result.records[key].lastAttemptAt! || !applicationOutcome(key, entry.outcome))
        throw Error("応用チェックの記録が不正です。");
      result.records[key].application = { at: entry.at as number, outcome: entry.outcome };
    }
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
export function currentDraft(state: Progress, key: string): Draft | undefined {
  const draft = state.drafts[key];
  if (!draft?.content) return undefined;
  if (key.endsWith('#prediction') && (state.records[key]?.lastAttemptAt ?? -1) >= draft.updatedAt)
    return undefined;
  return draft;
}
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const next: Progress = { schema: current.schema, records: { ...current.records }, drafts: { ...current.drafts }, legacy: { ...current.legacy } };
  for (const [key, value] of Object.entries(incoming.records)) {
    const old = next.records[key];
    if (!old) { next.records[key] = value; continue; }
    const newest = value.updatedAt > old.updatedAt ? value : old;
    const first = Math.min(old.firstCorrectAt ?? Infinity, value.firstCorrectAt ?? Infinity);
    const delayed = (value.delayed?.at ?? -1) > (old.delayed?.at ?? -1) ? value.delayed : old.delayed;
    const application = (value.application?.at ?? Infinity) < (old.application?.at ?? Infinity) ? value.application : old.application;
    const lastAttempt = newest.lastAttemptAt ?? -1;
    const keepFirst = first <= lastAttempt && first < (newest.firstCorrectAt ?? Infinity) && newest.blindCorrect > 0;
    const keepDelayed = delayed && delayed.at <= lastAttempt && delayed.at > (newest.delayed?.at ?? -1);
    const keepApplication = application && application.at <= lastAttempt && application.at < (newest.application?.at ?? Infinity);
    next.records[key] = keepFirst || keepDelayed || keepApplication ? {
      ...newest,
      ...(keepFirst ? { firstCorrectAt: first } : {}),
      ...(keepDelayed ? { delayed } : {}),
      ...(keepApplication ? { application } : {}),
    } : newest;
  }
  for (const [key, value] of Object.entries(incoming.drafts)) if (!next.drafts[key] || value.updatedAt > next.drafts[key].updatedAt) next.drafts[key] = value;
  for (const [key, draft] of Object.entries(next.drafts))
    if (key.endsWith('#prediction') && (next.records[key]?.lastAttemptAt ?? -1) >= draft.updatedAt)
      delete next.drafts[key];
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
  return { ...state, records: { ...state.records, [key]: { ...previous, updatedAt: now, ...(kind === 'hint' ? { hintsAt: now } : { solutionAt: now }) } } };
}
const onSameDay = (at: number | null, now: number) =>
  at !== null && new Date(at).toDateString() === new Date(now).toDateString();

export function recordPrediction(state: Progress, key: string, ok: boolean, now = Date.now(), assistanceVisible = false, uncertain = false): Progress {
  if (!validKey(key)) return state;
  const old = state.records[key] ?? blankRecord(now);
  const sameDay = onSameDay(old.lastAttemptAt, now);
  const assisted = assistanceVisible || sameDay || [old.hintsAt, old.solutionAt].some(at => onSameDay(at, now));
  const tentative = ok && !assisted && uncertain;
  const independent = ok && !assisted && !tentative;
  const keepDate = ok && !tentative && old.dueAt !== null && old.dueAt > now && (sameDay || !assisted);
  const advance = independent && old.lastOutcome !== 'tentative' && canRecordRecall(old, now);
  const reviewStep = advance ? Math.min(old.reviewStep + 1, INTERVALS.length - 1) : keepDate ? old.reviewStep : 0;
  const firstCorrectAt = old.firstCorrectAt ?? (old.lastOutcome === 'correct' && old.blindCorrect > 0 ? old.lastAttemptAt : null) ?? (independent ? now : undefined);
  const { delayed: previousDelayed, application, ...previous } = old;
  const delayed: DelayedPrediction | undefined = !assisted && canRecordRecall(old, now)
    ? { at: now, outcome: ok ? tentative ? 'tentative' : 'correct' : 'wrong' }
    : previousDelayed;
  const next: ProgressRecord = {
    ...previous, updatedAt: now, lastAttemptAt: now, solutionAt: now,
    lastOutcome: ok ? assisted ? 'assisted' : tentative ? 'tentative' : 'correct' : 'wrong',
    blindCorrect: old.blindCorrect + Number(independent), assistedCorrect: old.assistedCorrect + Number(ok && assisted), wrong: old.wrong + Number(!ok),
    reviewStep, dueAt: keepDate ? old.dueAt : tentative && old.dueAt !== null && old.dueAt > now ? Math.min(old.dueAt, now + DAY) : now + INTERVALS[reviewStep] * DAY,
    ...(firstCorrectAt !== undefined ? { firstCorrectAt: Math.min(firstCorrectAt, now) } : {}),
    ...(delayed && delayed.at <= now ? { delayed } : {}),
    ...(application && application.at <= now ? { application } : {}),
  };
  const drafts = { ...state.drafts };
  if (drafts[key] && drafts[key].updatedAt <= now) delete drafts[key];
  return { ...state, records: { ...state.records, [key]: next }, drafts };
}
export function canRecordRecall(record: ProgressRecord, now = Date.now()): boolean {
  return record.lastAttemptAt !== null && record.lastAttemptAt < now &&
    record.dueAt !== null && record.dueAt <= now &&
    ![record.lastAttemptAt, record.hintsAt, record.solutionAt].some(at => onSameDay(at, now));
}
export function recordRecall(state: Progress, key: string, now = Date.now()): Progress {
  const old = state.records[key]; if (!validKey(key) || !old || !canRecordRecall(old, now)) return state;
  const step = Math.min(old.reviewStep + 1, INTERVALS.length - 1);
  return { ...state, records: { ...state.records, [key]: { ...old, updatedAt: now, lastAttemptAt: now, recalls: old.recalls + 1, lastOutcome:'self-recall', reviewStep: step, dueAt: now + INTERVALS[step] * DAY } } };
}
export function saveDraft(state: Progress, key: string, content: string, now = Date.now()): Progress {
  if (!validDraftKey(key) || new TextEncoder().encode(content).byteLength > 65536) return state;
  return { ...state, drafts: { ...state.drafts, [key]: { content, updatedAt: now } } };
}
export function recordApplication(state: Progress, key: string, startedAt: number | undefined) {
  const record = state.records[key];
  if (startedAt === undefined || !record || record.application ||
      record.lastAttemptAt === null || record.lastAttemptAt < startedAt ||
      !applicationOutcome(key, record.lastOutcome)) return state;
  return { ...state, records: { ...state.records, [key]: { ...record,
    application: { at: record.lastAttemptAt, outcome: record.lastOutcome },
  } } };
}
export function saveLast(storage: Pick<Storage, 'setItem'>, language: Lang, id: string): void {
  if (!new RegExp(`^${language}:q[0-9]{4,}$`).test(id)) return;
  try { storage.setItem(LAST_KEY, JSON.stringify({ language, id })); } catch { /* progress warning is shown separately */ }
}
export function loadLast(storage: Pick<Storage, 'getItem'>): { language: Lang; id: string } | null {
  try { const raw = storage.getItem(LAST_KEY); if (!raw || raw.length > 200) return null; const x: unknown = JSON.parse(raw); return object(x) && (x.language === 'java' || x.language === 'rust') && typeof x.id === 'string' && new RegExp(`^${x.language}:q[0-9]{4,}$`).test(x.id) ? { language: x.language, id: x.id } : null; } catch { return null; }
}

/** Historical fixed-test checks do not certify the current draft or all possible inputs. */
export function recordCodeCheck(state:Progress,key:string,status:string,now=Date.now()):Progress{
 if(!validKey(key)||!key.endsWith('#code')||!['passed','failed','compile-error','runtime-error'].includes(status))return state;
 const old=state.records[key]??blankRecord(now),passed=status==='passed';
 return {...state,records:{...state.records,[key]:{...old,updatedAt:now,lastAttemptAt:now,dueAt:now+DAY,reviewStep:passed?old.reviewStep:0,lastOutcome:passed?'code-passed':'code-failed',codePasses:(old.codePasses??0)+Number(passed),codeFailures:(old.codeFailures??0)+Number(!passed)}}};
}
export function recordManualCodeCheck(state:Progress,key:string,now=Date.now()):Progress{
 if(!validKey(key)||!key.endsWith('#code'))return state;
 const old=state.records[key]??blankRecord(now);
 return {...state,records:{...state.records,[key]:{...old,updatedAt:now,lastAttemptAt:now,dueAt:now+DAY,lastOutcome:'self-check',manualCodeChecks:(old.manualCodeChecks??0)+1}}};
}
