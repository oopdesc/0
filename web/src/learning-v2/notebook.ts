import {
  currentDraft,
  questionNotes,
  recordKey,
  type Progress,
} from "./progress";
import type { StudyIndex } from "./studyPlanner";

const needsPractice = (outcome: string | undefined) =>
  outcome !== undefined &&
  ["wrong", "tentative", "assisted", "code-failed", "self-check"].includes(
    outcome,
  );

export function notebookItems(
  index: StudyIndex,
  progress: Progress,
  now = Date.now(),
) {
  const notes = questionNotes(progress);
  return index.items
    .flatMap((item) => {
      const key = recordKey(
        item.id,
        item.version,
        item.writing ? "code" : "prediction",
      );
      const record = progress.records[key];
      const note = notes.get(item.id);
      const draft = currentDraft(progress, key);
      const weak = needsPractice(record?.lastOutcome);
      const due = record?.dueAt != null && record.dueAt <= now;
      if (
        !note?.content &&
        !note?.bookmarked &&
        !record?.lastAttemptAt &&
        !draft
      )
        return [];
      return [
        {
          item,
          record,
          note,
          weak,
          due,
          draft: !!draft,
          updatedAt: Math.max(
            note?.updatedAt ?? 0,
            record?.updatedAt ?? 0,
            draft?.updatedAt ?? 0,
          ),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.weak) - Number(a.weak) ||
        Number(b.due) - Number(a.due) ||
        b.updatedAt - a.updatedAt,
    );
}
