/**
 * 学習状態の保存。
 * アカウントを作らず、ブラウザの localStorage にだけ保存する。
 * 形式にはバージョンを持たせ、読み込み時に検証して壊れたデータは捨てる。
 */
export interface Attempt {
  pid: string;
  at: number;
  ok: boolean;
  ms: number;
  role: 'predict' | 'retry' | 'review';
  surface: string;
}

export interface Card {
  /** 次に出す時刻（epoch ms） */
  due: number;
  /** 1/3/7/14/30 日のどの段階か */
  step: number;
  streak: number;
  lapses: number;
}

export interface ConceptStat {
  seen: number;
  correct: number;
  wrong: number;
  lastWrongAt: number | null;
  lastCorrectAt: number | null;
  /** 類題（transfer）で正解した回数 */
  transferOk: number;
  /** 時間を空けた復習で正解した回数 */
  reviewOk: number;
  lastRole: Attempt['role'] | null;
}

/** 学習者が保存した「1 行ルール」（My Rules）。問題の patch を自分用に残す。 */
export interface Rule {
  id: string;
  pid: string;
  text: string;
  at: number;
  /** この 1 行を根拠に問題を解いた回数 */
  uses: number;
  concept?: string;
}

export interface State {
  v: 1;
  theme: 'light' | 'dark' | 'system';
  reduceMotion: 'auto' | 'on' | 'off';
  spaceQuality: 'auto' | 'ultra' | 'high' | 'balanced' | 'battery';
  attempts: Attempt[];
  cards: Record<string, Card>;
  concepts: Record<string, ConceptStat>;
  /** ERROR LAB: 間違えた問題の履歴（新しい順） */
  errors: { pid: string; at: number; cause: string }[];
  days: { last: string; streak: number; total: number };
  /** 今日の 5 問の固定シード（日付ごとに 1 回だけ決める） */
  today: { date: string; ids: string[] };
  /** My Rules: 保存した 1 行ルール（新しい順） */
  rules: Rule[];
}

const KEY = '0.academy.state.v1';

export const INTERVALS = [1, 3, 7, 14, 30];

export function emptyState(): State {
  return {
    v: 1,
    theme: 'light',
    reduceMotion: 'auto',
    spaceQuality: 'auto',
    attempts: [],
    cards: {},
    concepts: {},
    errors: [],
    days: { last: '', streak: 0, total: 0 },
    today: { date: '', ids: [] },
    rules: [],
  };
}

function isState(x: unknown): x is State {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<State>;
  return s.v === 1 && typeof s.attempts === 'object' && typeof s.cards === 'object';
}

export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (!isState(parsed)) return emptyState();
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export function saveState(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 容量不足やプライベートモードでは保存しない（学習は続けられる） */
  }
}

/* ── 保存データの入出力 ───────────────────────────── */

export function exportState(s: State): string {
  return JSON.stringify({ ...s, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(json: string): { ok: true; state: State } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isState(parsed)) return { ok: false, error: 'このファイルは学習記録の形式ではありません。' };
    return { ok: true, state: { ...emptyState(), ...parsed } };
  } catch {
    return { ok: false, error: 'JSON として読み込めませんでした。' };
  }
}

/* ── 更新ロジック（純粋関数） ─────────────────────── */

export function nextInterval(step: number): number {
  return INTERVALS[Math.min(step, INTERVALS.length - 1)];
}

export function applyAttempt(
  s: State,
  a: { pid: string; ok: boolean; ms: number; role: Attempt['role']; surface: string; concepts: string[]; cause?: string },
): State {
  const now = Date.now();
  const day = new Date(now).toLocaleDateString('sv-SE'); // YYYY-MM-DD
  const prevCard = s.cards[a.pid] ?? { due: now, step: 0, streak: 0, lapses: 0 };
  // step は「次に使う間隔の番号」。0 = 1 日後、1 = 3 日後、2 = 7 日後、3 = 14 日後、4 = 30 日後。
  // 正解するたびに 1 つ進み、誤答したら 0（明日また出会う）へ戻す。
  const step = a.ok ? Math.min(prevCard.step, INTERVALS.length - 1) : 0;
  const nextStep = a.ok ? Math.min(step + 1, INTERVALS.length - 1) : 0;
  const card: Card = {
    due: now + INTERVALS[step] * 86_400_000,
    step: nextStep,
    streak: a.ok ? prevCard.streak + 1 : 0,
    lapses: prevCard.lapses + (a.ok ? 0 : 1),
  };

  const concepts = { ...s.concepts };
  for (const c of a.concepts) {
    const prev = concepts[c] ?? {
      seen: 0,
      correct: 0,
      wrong: 0,
      lastWrongAt: null,
      lastCorrectAt: null,
      transferOk: 0,
      reviewOk: 0,
      lastRole: null,
    };
    concepts[c] = {
      seen: prev.seen + 1,
      correct: prev.correct + (a.ok ? 1 : 0),
      wrong: prev.wrong + (a.ok ? 0 : 1),
      lastWrongAt: a.ok ? prev.lastWrongAt : now,
      lastCorrectAt: a.ok ? now : prev.lastCorrectAt,
      transferOk: prev.transferOk + (a.ok && a.role === 'retry' ? 1 : 0),
      reviewOk: prev.reviewOk + (a.ok && a.role === 'review' ? 1 : 0),
      lastRole: a.role,
    };
  }

  const errors = a.ok
    ? s.errors
    : [{ pid: a.pid, at: now, cause: a.cause ?? 'concept' }, ...s.errors].slice(0, 200);

  const days =
    s.days.last === day
      ? { ...s.days, total: s.days.total + 1 }
      : {
          last: day,
          streak: s.days.last && isYesterday(s.days.last, day) ? s.days.streak + 1 : 1,
          total: s.days.total + 1,
        };

  return {
    ...s,
    attempts: [...s.attempts, { pid: a.pid, at: now, ok: a.ok, ms: a.ms, role: a.role, surface: a.surface }].slice(-400),
    cards: { ...s.cards, [a.pid]: card },
    concepts,
    errors,
    days,
  };
}

function isYesterday(prev: string, today: string): boolean {
  const p = new Date(prev + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  return Math.round((t.getTime() - p.getTime()) / 86_400_000) === 1;
}

export function dueIds(s: State, now = Date.now()): string[] {
  return Object.entries(s.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}
