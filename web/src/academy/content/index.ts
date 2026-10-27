import type { Problem, Family, Curriculum } from './types';
import questions from './published.json';
import families from './families.json';
import { CONCEPTS } from './concepts';
export const FAMILIES = families as Family[];
export const PROBLEMS = questions as unknown as Problem[];
export const PROBLEM_BY_ID = new Map(PROBLEMS.map(p => [p.id,p]));
export const CURRICULUM: Curriculum = { families:FAMILIES, concepts:CONCEPTS, problems:PROBLEMS };
export const VERIFIED_VERSIONS = { java:'javac (archive fixture)', rust:'rustc (archive fixture)', javaGeneratedAt:'2026-10-27', rustGeneratedAt:'2026-10-27' };
export const PROBLEMS_BY_CONCEPT = (() => {
  const map = new Map<string, string[]>();
  for (const p of PROBLEMS) {
    for (const c of p.concepts) {
      const list = map.get(c) ?? [];
      list.push(p.id);
      map.set(c, list);
    }
  }
  return map;
})();

export function problemsForFamily(familyId: string) {
  return PROBLEMS.filter((p) => p.family === familyId);
}

export function conceptsForFamily(familyId: string) {
  return CONCEPTS.filter((c) => c.family === familyId);
}

export function issuesOfCurriculum(): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const p of PROBLEMS) {
    if (ids.has(p.id)) issues.push(`重複した問題 id: ${p.id}`);
    ids.add(p.id);
  }
  for (const p of PROBLEMS) {
    for (const c of p.concepts) {
      if (!CONCEPTS.some((x) => x.id === c)) issues.push(`${p.id}: 未知の概念 ${c}`);
    }
    if (p.transfer && !PROBLEM_BY_ID.has(p.transfer)) issues.push(`${p.id}: transfer 先 ${p.transfer} がありません`);
    for (const r of p.reviewVariants ?? []) {
      if (!PROBLEM_BY_ID.has(r)) issues.push(`${p.id}: reviewVariants ${r} がありません`);
    }
    if (!FAMILIES.some((f) => f.id === p.family && f.lang === p.lang)) issues.push(`${p.id}: 家族 ${p.family} が ${p.lang} にありません`);
  }
  return issues;
}
