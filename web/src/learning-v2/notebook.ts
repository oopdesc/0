import {
  currentDraft,
  questionNotes,
  recordKey,
  type Progress,
} from "./progress";
import { studyHref, type StudyIndex } from "./studyPlanner";

export const notebookLabels: Record<string, string> = {
  wrong: "予測の誤答",
  tentative: "迷いがあった正答",
  assisted: "解説・ヒント後の正答",
  "code-failed": "固定テストで差分",
  "self-check": "手元での自己確認",
};

const needsPractice = (outcome: string | undefined) =>
  outcome !== undefined &&
  ["wrong", "tentative", "assisted", "code-failed", "self-check"].includes(
    outcome,
  );

export function notebookText(
  entries: ReturnType<typeof notebookItems>,
  origin: string,
  now = new Date(),
) {
  const rows = entries.map((entry, index) =>
    [
      `${index + 1}. ${entry.item.title}（${entry.item.language === "java" ? "Java" : "Rust"}）`,
      new URL(studyHref(entry.item), origin).href,
      entry.weak ? notebookLabels[entry.record?.lastOutcome ?? ""] : "",
      entry.due ? "復習の時期" : "",
      entry.note?.bookmarked ? "あとで解く" : "",
      entry.note?.content ? "自分のメモ\n" + entry.note.content : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    "Java・Rust 学習ノート",
    now.toLocaleString("ja-JP"),
    `${entries.length}問`,
    "現在の絞り込みに合う通常問題と、このブラウザのメモです。",
    "",
    ...rows.flatMap((row) => [row, ""]),
  ].join("\n");
}

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
