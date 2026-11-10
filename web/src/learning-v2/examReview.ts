import type { Exam, Manifest, Question } from "./types";
import type { ExamAttempt } from "./examState";
import type { StudyIndex, StudyItem } from "./studyPlanner";
export type ExamReviewRow = {
  id: string;
  index: number;
  title: string;
  status: "correct" | "wrong" | "unanswered" | "ungraded";
  revealed: boolean;
  marked: boolean;
  practiceHref: string | null;
  practiceId: string | null;
  conceptIds: string[];
};
export function reviewExam(
  attempt: ExamAttempt,
  exam: Exam,
  questions: Question[],
  manifest: Manifest,
): ExamReviewRow[] {
  if (attempt.submittedAt === null) return [];
  const normal = new Set(manifest.chunks.flatMap((c) => c.ids)),
    byId = new Map(questions.map((q) => [q.id, q]));
  return [...exam.choiceQuestionIds, ...exam.codeQuestionIds].map(
    (id, index) => {
      const q = byId.get(id);
      if (!q) throw Error("見直す試験問題が見つかりません。");
      const selected = attempt.selections[id] ?? [],
        code = exam.codeQuestionIds.includes(id);
      const correct =
        selected.length > 0 &&
        [...selected].sort().join("\0") ===
          [...q.answer.correctOptionIds].sort().join("\0");
      const source = q.extensions?.reusedFrom;
      const practiceId = typeof source === "string" && normal.has(source) ? source : null;
      return {
        id,
        index,
        title: q.title,
        status: code
          ? "ungraded"
          : !selected.length
            ? "unanswered"
            : correct
              ? "correct"
              : "wrong",
        revealed: attempt.revealed.includes(id),
        marked: attempt.marked.includes(id),
        practiceHref: practiceId
          ? "/learn?" + new URLSearchParams({ section: "drill", lang: manifest.language, q: practiceId })
          : null,
        practiceId,
        conceptIds: q.conceptIds,
      };
    },
  );
}

export function planExamPractice(
  rows: readonly ExamReviewRow[],
  exam: Pick<Exam, "language" | "level">,
  index: StudyIndex,
) {
  const items = index.items.filter(q => q.language === exam.language && !q.writing);
  const byId = new Map(items.map(item => [item.id, item]));
  const levels = { beginner: 0, intermediate: 1, advanced: 2 };
  const used = new Set<string>();
  const selected: { item: StudyItem; row: ExamReviewRow; sameQuestion: boolean }[] = [];
  const targets = [
    ...rows.filter(row => row.status === "wrong"),
    ...rows.filter(row => row.status === "unanswered"),
    ...rows.filter(row => row.status === "correct" && row.revealed),
  ];
  const originals = new Set(targets.map(row => row.practiceId));
  for (const row of targets) {
    const original = row.practiceId ? byId.get(row.practiceId) : undefined;
    // Repeated copies of the same problem are one review target.
    if (original && used.has(original.id)) continue;
    const concepts = new Set(row.conceptIds);
    const related = original ? undefined : items
      .filter(item => !used.has(item.id) && !originals.has(item.id))
      .map(item => ({
        item,
        overlap: item.concepts.filter(concept => concepts.has(concept)).length,
        distance: Math.abs(levels[item.level] - levels[exam.level]),
      }))
      .filter(match => match.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || a.distance - b.distance ||
        a.item.unit - b.item.unit || a.item.order - b.item.order || a.item.id.localeCompare(b.item.id))[0]?.item;
    const item = original ?? related;
    if (!item) continue;
    used.add(item.id);
    selected.push({ item, row, sameQuestion: !!original });
    if (selected.length === 5) break;
  }
  return selected;
}
export const reviewLabels = {
  correct: "正答",
  wrong: "見直す",
  unanswered: "未回答",
  ungraded: "実装・未判定",
};
