import type { Progress } from "./progress";
import { itemKey, type StudyIndex, type StudyItem } from "./studyPlanner";
import type { Question } from "./types";

export type DiagnosticResult = { correct: boolean; uncertain: boolean };
type Target = Pick<Question, "id" | "language" | "level" | "conceptIds" | "prerequisiteConceptIds">;
const levels = { beginner: 0, intermediate: 1, advanced: 2 };
export const diagnosticPracticeLimit = 5;

export function planDiagnosticPractice(
  questions: readonly Target[],
  results: Readonly<Record<string, DiagnosticResult>>,
  index: StudyIndex,
  progress: Progress,
) {
  const targets = [
    ...questions.filter(({ id }) => results[id]?.correct === false),
    ...questions.filter(({ id }) => results[id]?.correct && results[id].uncertain),
  ];
  const originals = new Set(questions.map(({ id }) => id));
  const used = new Set<string>();
  const choices = index.items.filter(item => !item.writing);
  const plan: { item: StudyItem; sourceId: string; concept: string; relation: "same" | "prerequisite" | "original" }[] = [];

  for (const target of targets) {
    const candidates = choices.filter(item =>
      item.language === target.language && levels[item.level] <= levels[target.level] &&
      !originals.has(item.id) && !used.has(item.id),
    );
    const best = (concepts: string[]) => candidates.flatMap(item => {
      const matches = concepts.filter(concept => item.concepts.includes(concept));
      if (!matches.length) return [];
      const lastAttempt = progress.records[itemKey(item)]?.lastAttemptAt ?? null;
      return [{ item, matches, lastAttempt }];
    }).sort((a, b) => Number(a.lastAttempt !== null) - Number(b.lastAttempt !== null) ||
      b.matches.length - a.matches.length || levels[b.item.level] - levels[a.item.level] ||
      a.item.order - b.item.order || a.item.id.localeCompare(b.item.id))[0];

    const related = best(target.conceptIds);
    const prerequisite = related ? undefined : best(target.prerequisiteConceptIds);
    const match = related ?? prerequisite;
    const item = match?.item ?? choices.find(candidate => candidate.id === target.id);
    if (!item || used.has(item.id)) continue;
    used.add(item.id);
    const conceptId = match?.matches[0] ?? target.conceptIds[0];
    plan.push({
      item,
      sourceId: target.id,
      concept: index.concepts[conceptId]?.name ?? "",
      relation: related ? "same" : prerequisite ? "prerequisite" : "original",
    });
    if (plan.length === diagnosticPracticeLimit) break;
  }
  return plan;
}
