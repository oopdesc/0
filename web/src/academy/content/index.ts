import type { Problem, Family, Curriculum } from "./types";
import quarantined from "./quarantined-ids.json";
import families from "./families.json";
import { CONCEPTS } from "./concepts";
export const FAMILIES = families as Family[];
const excluded = new Set(quarantined);
export const PROBLEMS: Problem[] = [];
export const PROBLEM_BY_ID = new Map<string, Problem>();
export const PROBLEMS_BY_CONCEPT = new Map<string, string[]>();
export const CURRICULUM: Curriculum = {
  families: FAMILIES,
  concepts: CONCEPTS,
  problems: PROBLEMS,
};
export const VERIFIED_VERSIONS = {
  java: "javac (archive fixture)",
  rust: "rustc (archive fixture)",
  javaGeneratedAt: "2026-10-27",
  rustGeneratedAt: "2026-10-27",
};
let initialized = false;
/** Keep the archive outside executable JS. Install once, before rendering its UI. */
export function initializeProblems(raw: unknown): void {
  if (initialized) return;
  if (
    !Array.isArray(raw) ||
    raw.length < 1000 ||
    raw.length > 2000 ||
    raw.some(
      (p) =>
        !p ||
        typeof p.id !== "string" ||
        !["java", "rust"].includes(p.lang) ||
        !Array.isArray(p.concepts),
    )
  )
    throw Error("補充教材の形式を確認できません。");
  const questions = raw as Problem[];
  if (new Set(questions.map((p) => p.id)).size !== questions.length)
    throw Error("補充教材のIDが重複しています。");
  const published = questions
    .filter((p) => !excluded.has(p.id))
    .map((p) => ({
      ...p,
      transfer:
        p.transfer && !excluded.has(p.transfer) ? p.transfer : undefined,
      reviewVariants: p.reviewVariants?.filter((id) => !excluded.has(id)),
    }));
  PROBLEMS.push(...published);
  for (const p of PROBLEMS) {
    PROBLEM_BY_ID.set(p.id, p);
    for (const c of p.concepts) {
      const list = PROBLEMS_BY_CONCEPT.get(c) ?? [];
      list.push(p.id);
      PROBLEMS_BY_CONCEPT.set(c, list);
    }
  }
  initialized = true;
}

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
      if (!CONCEPTS.some((x) => x.id === c))
        issues.push(`${p.id}: 未知の概念 ${c}`);
    }
    if (p.transfer && !PROBLEM_BY_ID.has(p.transfer))
      issues.push(`${p.id}: transfer 先 ${p.transfer} がありません`);
    for (const r of p.reviewVariants ?? []) {
      if (!PROBLEM_BY_ID.has(r))
        issues.push(`${p.id}: reviewVariants ${r} がありません`);
    }
    if (!FAMILIES.some((f) => f.id === p.family && f.lang === p.lang))
      issues.push(`${p.id}: 家族 ${p.family} が ${p.lang} にありません`);
  }
  return issues;
}
