import { useState } from "react";
import { saveLearningNote, type LearningNote, type Progress } from "./progress";
import { questionNotes } from "./progress";
import "./notebook.css";

export default function QuestionNote({
  note,
  recordKey,
  update,
}: {
  note?: LearningNote;
  recordKey: string;
  update: (fn: (state: Progress) => Progress) => void;
}) {
  const [content, setContent] = useState(note?.content ?? "");
  const [notice, setNotice] = useState("");
  return (
    <details className="question-note">
      <summary>
        自分の言葉でメモする
        {content !== (note?.content ?? "")
          ? " · 未保存"
          : note?.content
            ? " · 保存あり"
            : ""}
      </summary>
      <label htmlFor="question-note">次に見直すときの手がかり</label>
      <textarea
        id="question-note"
        value={content}
        maxLength={2000}
        rows={3}
        placeholder="例：比較しているのは参照か値か。次は空の入力でも考える。"
        onChange={(event) => {
          setContent(event.target.value);
          setNotice("");
        }}
      />
      <div>
        <button
          type="button"
          disabled={content === (note?.content ?? "")}
          onClick={() => {
            update((state) =>
              saveLearningNote(state, recordKey, {
                content,
                bookmarked:
                  questionNotes(state).get(recordKey.split("@")[0])
                    ?.bookmarked ?? false,
              }),
            );
            setNotice(
              content
                ? "メモを学習ノートに追加しました。"
                : "メモを消しました。",
            );
          }}
        >
          メモを保存
        </button>
        <small>{content.length} / 2,000字</small>
        <a href="/learn?section=notebook">学習ノートで見直す →</a>
      </div>
      {notice && <p role="status">{notice}</p>}
      <small>このブラウザに保存します。学習記録の書き出しに含まれます。</small>
    </details>
  );
}
