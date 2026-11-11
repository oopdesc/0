import type { ProgressOutcome } from "./progress";
import { readStudyFilter, roundResultLabel, type StudyRound } from "./studyRound";
import type { StudyIndex } from "./studyPlanner";

export const shortSessionSize = 3;
export const studyPreferencesKey = "0.learning-v2.today-preferences.v1";

export function dailyStudyFilter(search: string, storage: Pick<Storage, "getItem"> | null) {
  const params = new URLSearchParams(search);
  if (["lang", "level", "kind", "limit", "new", "concept"].some(key => params.has(key))) {
    return readStudyFilter(params);
  }
  try {
    const saved = storage?.getItem(studyPreferencesKey);
    if (saved && saved.length <= 512) return readStudyFilter(new URLSearchParams(saved));
  } catch { /* This browser may disallow storage. */ }
  return readStudyFilter(params);
}

const reviewPriority: Partial<Record<ProgressOutcome | "skipped", number>> = {
  wrong: 0,
  "code-failed": 0,
  tentative: 1,
  assisted: 2,
  skipped: 3,
};
export const followUpLimit = 5;

export function completedStudy(round: StudyRound, items: StudyIndex["items"]) {
  if (round.outcomes.length !== round.ids.length) return null;

  const byId = new Map(items.map(item => [item.id, item]));
  const counts = new Map<string, number>();
  const rows = [];
  const followUp: { id: string; priority: number }[] = [];
  for (const [index, id] of round.ids.entries()) {
    const skipped = round.outcomes[index] === "skipped";
    const result = round.results?.[index];
    const label = skipped ? "飛ばした" : result ? roundResultLabel(result) : "結果の記録なし";
    counts.set(label, (counts.get(label) ?? 0) + 1);

    const item = byId.get(id);
    if (!item) continue;
    rows.push({ item, label });
    const priority = skipped ? reviewPriority.skipped : result ? reviewPriority[result] : undefined;
    if (round.purpose !== "follow-up" && priority !== undefined) followUp.push({ id, priority });
  }

  return {
    counts: [...counts],
    rows,
    followUpIds: followUp.sort((a, b) => a.priority - b.priority)
      .slice(0, followUpLimit).map(({ id }) => id),
  };
}
