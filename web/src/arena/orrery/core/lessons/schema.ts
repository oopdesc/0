/** Reusable lesson schema. Every lesson is data; no lesson-specific UI code. */
import type { Dialect } from '../lang';
import type { PresetId } from '../world';

export type ChallengeKind =
  | 'example'   // 完成例
  | 'explain'   // 説明
  | 'read'      // コード読解
  | 'trace'     // 処理追跡
  | 'predict'   // 予測
  | 'fill'      // 穴埋め
  | 'order'     // コード並べ替え
  | 'partial'   // 部分生成
  | 'build'     // 自力生成
  | 'debug'     // デバッグ
  | 'transfer'  // 初見類題
  | 'retrieve'  // 時間を空けた再生
  | 'project';  // 小プロジェクト

/** Higher = less scaffolding. Learners may skip forward if they can prove it. */
export const SUPPORT_LEVEL: Record<ChallengeKind, number> = {
  example: 0, explain: 1, read: 2, trace: 3, predict: 3, fill: 4, order: 5,
  partial: 6, build: 7, debug: 8, transfer: 9, retrieve: 9, project: 10,
};

export const KIND_LABEL: Record<ChallengeKind, string> = {
  example: '完成例', explain: '説明', read: 'コード読解', trace: '処理追跡', predict: '予測',
  fill: '穴埋め', order: '並べ替え', partial: '部分生成', build: '自力生成', debug: 'デバッグ',
  transfer: '初見類題', retrieve: '思い出す', project: '小プロジェクト',
};

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  dialect: Dialect;
  concept: string;
  prompt: string;
  /** Shown as the correct-rule summary after the attempt. */
  explanation: string;
  /** The single short rule saved for later retrieval (1 行パッチ). */
  patch: string;
  /** Prose for explain / read challenges. */
  reading?: string;
  /** Code shown to the learner. May contain ____ blanks. */
  code?: string;
  /** Editable starting point for build / debug / partial / fill. */
  starter?: string;
  /** Verified correct code. Used by the reveal step and by the content tests. */
  solution?: string;
  /** Multiple-choice prediction options (exact strings). */
  options?: string[];
  /** Correct option / short answer, compared after normalisation. */
  answer?: string;
  /** Expected console lines when `solution` is executed. */
  expectedOutput?: string[];
  /** Expected number of celestial bodies after `solution` is executed. */
  expectedBodies?: number;
  /** Universe preset loaded before running. */
  preset?: PresetId;
  /** Opt-in educational Rust borrow checker for this challenge. */
  checkBorrows?: boolean;
  hints?: string[];
  /** Lines (already correct) for order challenges; shuffled deterministically for display. */
  lines?: string[];
  transferOf?: string;
  /** Free-form verification note shown on success. */
  successNote?: string;
}

export type Track = 'java' | 'rust' | 'bridge';

export interface Lesson {
  id: string;
  track: Track;
  title: string;
  kicker: string;
  summary: string;
  concepts: string[];
  minutes: number;
  challenges: Challenge[];
}

export const TRACK_LABEL: Record<Track, string> = {
  java: 'Java', rust: 'Rust', bridge: 'Java × Rust',
};

/** Normalise learner answers: trim, unify width/digits, collapse whitespace. */
export function normaliseAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isCorrectAnswer(given: string, expected: string): boolean {
  return normaliseAnswer(given) === normaliseAnswer(expected);
}

/** Deterministic shuffle so the ordering challenge is reproducible and testable. */
export function shuffleLines(lines: string[], salt: string): string[] {
  let seed = 2166136261 >>> 0;
  for (const ch of salt) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  // Never return the already-correct order.
  if (out.join('\n') === lines.join('\n') && out.length > 1) {
    [out[0], out[1]] = [out[1] as string, out[0] as string];
  }
  return out;
}
