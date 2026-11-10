import { currentDraft, type Progress, type ProgressOutcome } from "./progress";
import { itemKey, type StudyFilter, type StudyIndex, type StudyItem } from "./studyPlanner";

const DAY = 86_400_000;
export const applicationExamples = { java: "java:q0001", rust: "rust:q30172" } as const;

export function applicationHistory(index: StudyIndex, state: Progress) {
  const counts = new Map<ProgressOutcome, number>();
  for (const item of index.items) {
    const result = state.records[itemKey(item)]?.application;
    if (result) counts.set(result.outcome, (counts.get(result.outcome) ?? 0) + 1);
  }
  return counts;
}

export function planApplications(
  index: StudyIndex,
  state: Progress,
  language: StudyFilter["language"],
  kind: "prediction" | "code",
  now = Date.now(),
) {
  const items = new Map(index.items.map(item => [item.id, item]));
  const candidates: { source: StudyItem; item: StudyItem; readyAt: number }[] = [];
  for (const [from, to] of index.applications ?? []) {
    const source = items.get(from), item = items.get(to);
    if (!source || !item || item.writing !== (kind === "code") ||
        (language !== "all" && item.language !== language)) continue;
    const prior = state.records[itemKey(source)];
    const first = prior?.firstCorrectAt ?? (prior?.lastOutcome === "correct" ? prior.lastAttemptAt : null);
    if (first === null || first === undefined || !prior?.blindCorrect ||
        (prior.lastOutcome !== "correct" && prior.lastOutcome !== "self-recall")) continue;
    const key = itemKey(item);
    // Keep a question out after the learner has attempted it, viewed help, or started a draft.
    if (state.records[key] || currentDraft(state, key)) continue;
    candidates.push({ source, item, readyAt: first + DAY });
  }
  candidates.sort((a, b) => a.readyAt - b.readyAt);
  const used = new Set<string>();
  const ready = candidates.filter(({ item, readyAt }) => {
    if (readyAt > now || used.has(item.id)) return false;
    used.add(item.id);
    return true;
  });
  const next = candidates.find(candidate => candidate.readyAt > now)?.readyAt;
  return { ready: ready.slice(0, 5), next };
}
