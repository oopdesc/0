import type { Exam, Manifest, Question } from "./types";
import type { ExamAttempt } from "./examState";
export type ExamReviewRow = {
  id: string;
  index: number;
  title: string;
  status: "correct" | "wrong" | "unanswered" | "ungraded";
  revealed: boolean;
  marked: boolean;
  practiceHref: string | null;
  conceptNames: string[];
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
        practiceHref:
          typeof source === "string" && normal.has(source)
            ? "/learn?section=drill&lang=" +
              manifest.language +
              "&q=" +
              encodeURIComponent(source)
            : null,
        conceptNames: q.conceptIds,
      };
    },
  );
}
export const reviewLabels = {
  correct: "正答",
  wrong: "見直す",
  unanswered: "未回答",
  ungraded: "実装・未判定",
};
