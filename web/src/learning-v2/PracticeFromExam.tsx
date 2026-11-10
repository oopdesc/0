import { useEffect, useRef, useState } from "react";
import { planExamPractice, type ExamReviewRow } from "./examReview";
import { confirmStudyRoundReplacement, resumeStudyRound, roundHref, startStudyRound } from "./studyRound";
import type { Exam } from "./types";

export function PracticeFromExam({
  rows,
  exam,
  navigate,
}: {
  rows: ExamReviewRow[];
  exam: Exam;
  navigate: (href: string) => void;
}) {
  const [practice, setPractice] = useState<ReturnType<typeof planExamPractice> | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const resume = resumeStudyRound();
  useEffect(() => () => request.current?.abort(), []);
  if (!rows.some(row => row.status === "wrong" || row.status === "unanswered" ||
    (row.status === "correct" && row.revealed))) return null;

  async function prepare() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setNotice("");
    try {
      const { loadStudyIndex } = await import("./studyPlanner");
      const index = await loadStudyIndex(controller.signal);
      if (!controller.signal.aborted) setPractice(planExamPractice(rows, exam, index));
    } catch {
      if (!controller.signal.aborted) setNotice("問題の一覧を読み込めませんでした。もう一度試してください。");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function start() {
    if (!practice?.length || !confirmStudyRoundReplacement()) return;
    const round = startStudyRound(practice.map(({ item }) => item.id), {
      language: exam.language,
      level: "all",
      kind: "prediction",
      limit: 5,
      includeNew: false,
    });
    if (round) navigate(roundHref(round));
    else setNotice("復習セットを保存できませんでした。この画面の見直し一覧を使えます。");
  }

  return (
    <div className="zlv-write-note">
      {!practice ? (
        <button type="button" onClick={() => void prepare()} disabled={loading}>
          {loading ? "復習問題を探しています…" : "試験結果から復習セットを作る"}
        </button>
      ) : practice.length ? (
        <>
          <strong>試験の見直し {practice.length}問</strong>
          <p>誤答、未回答、解答を見て正答した問題の順に選びます。</p>
          <ol aria-label="試験から選んだ復習問題">
            {practice.map(({ item, row, sameQuestion }) => (
              <li key={item.id}>
                {item.title}
                <small>（試験の第{row.index + 1}問・{sameQuestion ? "元の問題" : "同じ概念の練習"}）</small>
              </li>
            ))}
          </ol>
          {resume && <p>始めると進行中のセットが切り替わります。<a href={resume}>今のセットに戻る →</a></p>}
          <button type="button" onClick={start}>この{practice.length}問で復習を始める →</button>
        </>
      ) : <p>対応する練習問題がありません。下の一覧で試験の解説を確認できます。</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
