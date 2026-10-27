import { LESSON_IDS, type LessonId, type Stage } from './types';

const KEY = 'orbit-code-progress-v1';
export interface LessonProgress {
  attempts: number;
  correct: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  support: 0 | 1 | 2; // 0: detailed, 1: guided, 2: minimal
  completed: boolean;
  recalled: boolean;
  dueAt: number | null;
  reviewCount: number;
  savedPatch: boolean;
}
export interface ProgressState { version: 1; lessons: Record<LessonId, LessonProgress> }
const blank = (): LessonProgress => ({ attempts: 0, correct: 0, consecutiveCorrect: 0, consecutiveWrong: 0, support: 0, completed: false, recalled: false, dueAt: null, reviewCount: 0, savedPatch: false });
export function freshProgress(): ProgressState {
  return { version: 1, lessons: Object.fromEntries(LESSON_IDS.map((id) => [id, blank()])) as Record<LessonId, LessonProgress> };
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, max = 100000): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max ? v : 0;
export function parseProgress(raw: string | null): ProgressState {
  const clean = freshProgress();
  if (!raw || raw.length > 30_000) return clean;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !isRecord(data.lessons)) return clean;
    for (const id of LESSON_IDS) {
      const source = data.lessons[id];
      if (!isRecord(source)) continue;
      const support = integer(source.support, 2) as 0 | 1 | 2;
      const dueAt = typeof source.dueAt === 'number' && Number.isFinite(source.dueAt) && source.dueAt >= 0 && source.dueAt <= 9e15 ? source.dueAt : null;
      clean.lessons[id] = { attempts: integer(source.attempts), correct: integer(source.correct), consecutiveCorrect: integer(source.consecutiveCorrect, 2), consecutiveWrong: integer(source.consecutiveWrong, 2), support, completed: source.completed === true, recalled: source.recalled === true, dueAt, reviewCount: integer(source.reviewCount), savedPatch: source.savedPatch === true };
    }
  } catch { return clean; }
  return clean;
}
export function loadProgress(): { data: ProgressState; available: boolean } {
  try { return { data: parseProgress(window.localStorage.getItem(KEY)), available: true }; }
  catch { return { data: freshProgress(), available: false }; }
}
export function saveProgress(state: ProgressState): boolean {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function recordAttempt(state: ProgressState, id: LessonId, correct: boolean, successfulRun: boolean, stage: Stage, recallSatisfied: boolean, now = Date.now()): ProgressState {
  const p = { ...state.lessons[id] };
  p.attempts++; p.correct += correct ? 1 : 0;
  p.consecutiveCorrect = correct ? p.consecutiveCorrect + 1 : 0;
  p.consecutiveWrong = correct ? 0 : p.consecutiveWrong + 1;
  if (p.consecutiveCorrect >= 2) { p.support = Math.min(2, p.support + 1) as 0 | 1 | 2; p.consecutiveCorrect = 0; }
  if (p.consecutiveWrong >= 2) { p.support = Math.max(0, p.support - 1) as 0 | 1 | 2; p.consecutiveWrong = 0; }
  if (correct && successfulRun) {
    p.completed = true;
    if (p.dueAt === null) p.dueAt = now + 86_400_000;
    if (stage === 'recall' && recallSatisfied) p.recalled = true;
  }
  if (!correct || !successfulRun) p.savedPatch = true;
  return { ...state, lessons: { ...state.lessons, [id]: p } };
}
export function scheduleReview(state: ProgressState, id: LessonId, successful: boolean, now = Date.now()): ProgressState {
  const p = { ...state.lessons[id] };
  const intervals = [1, 3, 7, 14, 30];
  if (successful) { p.reviewCount++; p.dueAt = now + intervals[Math.min(p.reviewCount, intervals.length - 1)] * 86_400_000; }
  else { p.dueAt = now + 10 * 60_000; }
  return { ...state, lessons: { ...state.lessons, [id]: p } };
}
export function formatDue(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return '未登録';
  if (timestamp <= now) return '今が復習時';
  const hours = Math.ceil((timestamp - now) / 3_600_000);
  if (hours < 24) return `約${hours}時間後`;
  return `約${Math.ceil(hours / 24)}日後`;
}
