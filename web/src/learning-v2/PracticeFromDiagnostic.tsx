import { useEffect, useRef, useState } from "react";
import { diagnosticPracticeLimit, planDiagnosticPractice, type DiagnosticResult } from "./diagnosticPractice";
import type { Progress } from "./progress";
import { confirmStudyRoundReplacement, resumeStudyRound, roundHref, startStudyRound } from "./studyRound";
import { loadStudyIndex } from "./studyPlanner";
import type { Lang, Question } from "./types";

export function PracticeFromDiagnostic({ questions, results, progress, language, navigate }: {
  questions: Question[];
  results: Record<string, DiagnosticResult>;
  progress: Progress;
  language: Lang;
  navigate?: (href: string) => void;
}) {
  const [plan, setPlan] = useState<ReturnType<typeof planDiagnosticPractice> | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function prepare() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setNotice("");
    try {
      const index = await loadStudyIndex(controller.signal);
      if (!controller.signal.aborted) setPlan(planDiagnosticPractice(questions, results, index, progress));
    } catch {
      if (!controller.signal.aborted) setNotice("問題の一覧を読み込めませんでした。もう一度試してください。");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function start() {
    if (!plan?.length || !confirmStudyRoundReplacement()) return;
    const round = startStudyRound(plan.map(({ item }) => item.id), {
      language, level: "all", kind: "prediction", limit: diagnosticPracticeLimit, includeNew: false,
    });
    if (!round) {
      setNotice("復習セットを保存できませんでした。一覧のリンクから個別に復習できます。");
      return;
    }
    if (navigate) navigate(roundHref(round));
    else window.location.assign(roundHref(round));
  }

  const resume = plan?.length ? resumeStudyRound() : null;
  return (
    <section className="zlv-write-note" aria-label="途中確認から復習">
      <h4>つまずいたところを練習する</h4>
      <p>間違えた問題、迷って正解した問題の順に、最大{diagnosticPracticeLimit}問の復習を選べます。</p>
      {!plan ? (
        <button type="button" onClick={() => void prepare()} disabled={loading}>
          {loading ? "復習問題を探しています…" : "途中確認から復習セットを作る"}
        </button>
      ) : plan.length ? (
        <>
          <ol aria-label="途中確認から選んだ復習問題">
            {plan.map(({ item, sourceId, concept, relation }) => (
              <li key={item.id}>
                <a href={"/learn?" + new URLSearchParams({ section: "drill", lang: language, q: item.id })}>{item.title}</a>
                <small>（第{questions.findIndex(q => q.id === sourceId) + 1}問・{{
                  same: "同じ概念の別問題", prerequisite: "前提の練習", original: "元の問題を解き直す",
                }[relation]}{concept && `・${concept}`}）</small>
              </li>
            ))}
          </ol>
          {resume && <p>始めると進行中のセットが切り替わります。<a href={resume}>今のセットに戻る →</a></p>}
          <button type="button" onClick={start}>この{plan.length}問で復習を始める →</button>
        </>
      ) : <p>復習候補が見つかりませんでした。下の一覧で各問題の解説を確認できます。</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
