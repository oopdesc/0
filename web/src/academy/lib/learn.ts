/**
 * 学習の選び方と状態の意味づけ。
 * ここにロジックを集約し、画面は「どの問題を、どの理由で出すか」だけを受け取る。
 */
import { PROBLEMS, PROBLEM_BY_ID, FAMILIES, conceptsForFamily } from '../content';
import { CONCEPTS } from '../content/concepts';
import { CAUSES } from '../content/causes';
import type { Concept, Problem } from '../content/types';
import { dueIds, type State } from '../state/store';

export const CONCEPT_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
export const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

export function getProblem(id: string): Problem | undefined {
  return PROBLEM_BY_ID.get(id);
}

export function familyOf(p: Problem) {
  return FAMILY_BY_ID.get(p.family);
}

export function conceptName(id: string): string {
  return CONCEPT_BY_ID.get(id)?.name ?? id;
}

export function causeName(id: string): string {
  return CAUSES.find((c) => c.id === id)?.label ?? id;
}

export function causeDrill(id: string): string {
  return CAUSES.find((c) => c.id === id)?.drill ?? '';
}

/** 同じ核心を別の面から問う問題（なければ null） */
export function transferOf(p: Problem): Problem | null {
  if (p.transfer) {
    const t = PROBLEM_BY_ID.get(p.transfer);
    if (t) return t;
  }
  const siblings = PROBLEMS.filter(
    (q) => q.id !== p.id && q.lang === p.lang && q.concepts.some((c) => p.concepts.includes(c)),
  );
  if (!siblings.length) return null;
  // 直近に解いていないものを優先し、同点は id 順（決定的）
  return siblings.sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function reviewVariantsOf(p: Problem): Problem[] {
  const ids = p.reviewVariants ?? [];
  return ids.map((id) => PROBLEM_BY_ID.get(id)).filter((x): x is Problem => Boolean(x));
}

/* ── 進捗の状態 ─────────────────────────────────── */

export type ProgressKey =
  | 'untouched'
  | 'learning'
  | 'unstable'
  | 'due'
  | 'reproduced'
  | 'transfer'
  | 'weak'
  | 'recent_error';

export const PROGRESS_LABEL: Record<ProgressKey, string> = {
  untouched: '未学習',
  learning: '学習中',
  unstable: '正答したが未定着',
  due: '復習期限',
  reproduced: '再現成功',
  transfer: '類題成功',
  weak: '苦手概念',
  recent_error: '最近の誤差',
};

const RECENT = 24 * 3600 * 1000;

/** 優先度の高い順（1 つの概念に対して 1 つの状態を返す） */
export function progressOf(conceptId: string, s: State): ProgressKey {
  const c = s.concepts[conceptId];
  if (!c || c.seen === 0) return 'untouched';
  const now = Date.now();
  if (c.lastWrongAt && now - c.lastWrongAt < RECENT) return 'recent_error';
  if (c.wrong >= 2 && c.wrong >= c.correct) return 'weak';
  const due = Object.entries(s.cards).some(([pid, card]) => {
    const p = PROBLEM_BY_ID.get(pid);
    return card.due <= now && p?.concepts.includes(conceptId);
  });
  if (due) return 'due';
  if (c.transferOk > 0) return 'transfer';
  if (c.reviewOk > 0) return 'reproduced';
  if (c.correct > 0) return c.correct >= 2 ? 'reproduced' : 'unstable';
  return 'learning';
}

export function trackProgress(lang: 'java' | 'rust', s: State) {
  const ids = PROBLEMS.filter((p) => p.lang === lang).flatMap((p) => p.concepts);
  const uniq = [...new Set(ids)];
  const counts: Record<ProgressKey, number> = {
    untouched: 0,
    learning: 0,
    unstable: 0,
    due: 0,
    reproduced: 0,
    transfer: 0,
    weak: 0,
    recent_error: 0,
  };
  for (const id of uniq) counts[progressOf(id, s)]++;
  return { total: uniq.length, counts };
}

/* ── 出題の選択 ─────────────────────────────────── */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 決定的な擬似乱数（同じ種なら同じ並び） */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  let x = hashSeed(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function todayKey(now = new Date()): string {
  return now.toLocaleDateString('sv-SE');
}

/**
 * 今日の 5 問。
 * 1) 復習期限のもの 2) 苦手な概念 3) 未学習（順序は家族の順）から、
 * 日付を種にして決定的に選ぶ。同じ日なら何度開いても同じ 5 問。
 */
export function todayFive(s: State, now = new Date()): Problem[] {
  const key = todayKey(now);
  if (s.today.date === key && s.today.ids.length) {
    const fixed = s.today.ids.map((id) => PROBLEM_BY_ID.get(id)).filter((p): p is Problem => Boolean(p));
    if (fixed.length) return fixed;
  }
  const due = dueIds(s)
    .map((id) => PROBLEM_BY_ID.get(id))
    .filter((p): p is Problem => Boolean(p));
  const weak = PROBLEMS.filter((p) =>
    p.concepts.some((c) => {
      const st = s.concepts[c];
      return st && st.wrong >= 2 && st.wrong >= st.correct;
    }),
  );
  const fresh = PROBLEMS.filter((p) => !s.cards[p.id]);

  const picked: Problem[] = [];
  const push = (p?: Problem) => {
    if (p && !picked.some((x) => x.id === p.id) && picked.length < 5) picked.push(p);
  };

  for (const p of seededShuffle(due, key + 'due')) push(p);
  for (const p of seededShuffle(weak, key + 'weak')) push(p);
  for (const p of fresh) push(p); // 家族順（易しい順）で自然に入る
  if (picked.length < 5) for (const p of seededShuffle(PROBLEMS, key + 'any')) push(p);
  return picked.slice(0, 5);
}

export function reviewQueue(s: State, now = Date.now()): Problem[] {
  return reviewQueueDetailed(s, now).map((x) => x.problem);
}

/**
 * 復習で出す 1 問と、その元になったカード。
 *
 * 同じ問題をもう一度そのまま出すと「この問題の答え」を覚えてしまう。
 * 復習では reviewVariants のうち 1 つを、カードの step（復習回数）で決まる順に出す。
 * 選んだ問題が元の問題と違うときも、予定表（SRS）は元のカードを進める。
 */
export interface ReviewItem {
  problem: Problem;
  /** SRS のカードを持っている問題（復習の予定を進める対象） */
  sourceId: string;
}

export function reviewQueueDetailed(s: State, now = Date.now()): ReviewItem[] {
  const out: ReviewItem[] = [];
  const used = new Set<string>();
  for (const id of dueIds(s, now)) {
    const src = PROBLEM_BY_ID.get(id);
    if (!src) continue;
    const step = s.cards[id]?.step ?? 0;
    const variants = (src.reviewVariants ?? []).filter(
      (v) => v !== id && PROBLEM_BY_ID.has(v) && !used.has(v),
    );
    const pick = variants.length ? variants[step % variants.length] : undefined;
    const problem = (pick && PROBLEM_BY_ID.get(pick)) || src;
    used.add(problem.id);
    out.push({ problem, sourceId: id });
  }
  return out;
}

export function nextAfter(p: Problem, s: State): { problem: Problem | null; reason: string } {
  const t = transferOf(p);
  if (t) return { problem: t, reason: '同じ核心を、別の見た目で確認する' };
  const sameConceptDue = reviewQueue(s).find((q) => q.concepts.some((c) => p.concepts.includes(c)));
  if (sameConceptDue && sameConceptDue.id !== p.id)
    return { problem: sameConceptDue, reason: '復習期限が来ている類題' };
  const family = PROBLEMS.filter((q) => q.lang === p.lang && q.family === p.family && q.id !== p.id);
  const next = family.find((q) => !s.cards[q.id]) ?? family[0] ?? null;
  return { problem: next, reason: next ? '同じ分野の次の問題' : 'この分野は以上' };
}

export function conceptsOfFamily(familyId: string): Concept[] {
  return conceptsForFamily(familyId);
}

export function familyProblemCount(familyId: string): number {
  return PROBLEMS.filter((p) => p.family === familyId).length;
}

/** 表示用: 追跡に使う family の並び（言語ごと） */
export function familiesOf(lang: 'java' | 'rust') {
  return FAMILIES.filter((f) => f.lang === lang).sort((a, b) => a.order - b.order);
}
