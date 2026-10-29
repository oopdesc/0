import { useEffect, useRef, useState } from "react";
import { QuestionPanel } from "./PackLearning";
import {
  loadManifest,
  loadChunk,
  loadConcepts,
  loadExams,
  loadExamQuestions,
} from "./loader";
import {
  emptyProgress,
  loadProgress,
  mergeProgress,
  saveProgress,
} from "./progress";
import type { Progress } from "./progress";
import type { CatalogItem } from "./catalog";
import type { Question, Concept } from "./types";
export default function JourneyPackQuestion({ item }: { item: CatalogItem }) {
  const [data, setData] = useState<{
      id: string;
      q: Question;
      concepts: Concept[];
      version: string;
    } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [initial] = useState(() => {
    try {
      return loadProgress(localStorage);
    } catch {
      return {
        state: emptyProgress(),
        writable: false,
        error: "ブラウザ保存を利用できません。",
      };
    }
  });
  const [progress, setProgress] = useState(initial.state),
    ref = useRef(progress);
  ref.current = progress;
  const [notice, setNotice] = useState(initial.error || "");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    async function load() {
      const m = await loadManifest(item.language, c.signal),
        concepts = await loadConcepts(m, c.signal);
      let qs: Question[];
      if (item.source === "exam") {
        const exams = await loadExams(m, c.signal),
          exam = exams.find((e) =>
            [...e.choiceQuestionIds, ...e.codeQuestionIds].includes(item.id),
          );
        if (!exam) throw Error("この試験問題が見つかりません。");
        qs = await loadExamQuestions(m, exam, c.signal);
      } else {
        const chunk = m.chunks.find((x) => x.ids.includes(item.id));
        if (!chunk) throw Error("この問題が見つかりません。");
        qs = await loadChunk(m, chunk.path, c.signal);
      }
      const q = qs.find((x) => x.id === item.id);
      if (!q) throw Error("問題のIDが一致しません。");
      if (!c.signal.aborted)
        setData({ id: item.id, q, concepts, version: m.contentVersion });
    }
    load().catch((e) => {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "問題を読み込めません。");
    });
    return () => c.abort();
  }, [item.id, item.language, item.source, retry]);
  function update(fn: (p: Progress) => Progress) {
    let base = ref.current,
      blocked = "";
    try {
      const old = loadProgress(localStorage);
      if (!initial.writable || !old.writable)
        throw Error(old.error || "既存記録を読み取れません。");
      base = mergeProgress(old.state, base);
    } catch (e) {
      blocked = e instanceof Error ? e.message : "保存できません。";
    }
    const next = fn(base);
    ref.current = next;
    setProgress(next);
    if (!blocked) {
      try {
        const saved = saveProgress(localStorage, next);
        if (!saved.ok) throw Error(saved.error || "保存できません。");
        setNotice("");
        return;
      } catch (e) {
        blocked = e instanceof Error ? e.message : "保存できません。";
      }
    }
    setNotice(
      "今回の解答記録は保存できません。既存記録を上書きしていません。" +
        blocked,
    );
  }

  if (error)
    return (
      <div role="alert" className="journey-message">
        <p>{error}</p>
        <button onClick={() => setRetry((x) => x + 1)}>読み直す</button>
      </div>
    );
  if (!data || data.id !== item.id)
    return <p role="status">この一問を読み込んでいます…</p>;
  return (
    <div className="zlv journey-question">
      {notice && <p role="status">{notice}</p>}
      {item.source === "exam" && (
        <p className="journey-message">
          試験の問題を一問ずつ練習しています。試験の時間・得点・合否は変更しません。
        </p>
      )}
      <QuestionPanel
        key={data.id}
        q={data.q}
        packVersion={data.version}
        lang={item.language}
        view="all"
        concepts={data.concepts}
        progress={progress}
        update={update}
        prev={null}
        next={null}
      />
    </div>
  );
}
