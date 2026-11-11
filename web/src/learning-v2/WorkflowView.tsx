import { useEffect, useRef, useState } from "react";
import { loadProgress, saveDraft, saveProgress } from "./progress";
import {
  editWorkflowDraft,
  readWorkflowDraft,
  validateWorkflow,
  workflowKey,
  type WorkflowCourse,
  type WorkflowStage,
} from "./workflow";
import "./workflow.css";

function StageEditor({
  stage,
  index,
}: {
  stage: WorkflowStage;
  index: number;
}) {
  const [initial] = useState(() => {
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable)
        throw Error(saved.error ?? "学習記録を読み取れません。");
      return {
        draft: readWorkflowDraft(
          saved.state.drafts[workflowKey(index)]?.content,
          stage,
        ),
        error: "",
      };
    } catch (error) {
      return {
        draft: readWorkflowDraft(undefined, stage),
        error:
          error instanceof Error ? error.message : "保存を読み取れません。",
      };
    }
  });
  const [draft, setDraft] = useState(initial.draft);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const mounted = useRef(true);
  const [notice, setNotice] = useState(initial.error);
  function flush() {
    if (!dirty.current || initial.error) return;
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable)
        throw Error(saved.error ?? "既存の記録を読み取れません。");
      const next = saveDraft(
        saved.state,
        workflowKey(index),
        JSON.stringify(latest.current),
      );
      const result = saveProgress(localStorage, next);
      if (!result.ok) throw Error(result.error ?? "保存できません。");
      dirty.current = false;
      if (mounted.current) setNotice("このブラウザに保存しました。");
    } catch (error) {
      if (mounted.current)
        setNotice(error instanceof Error ? error.message : "保存できません。");
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    mounted.current = true;
    const save = () => flushRef.current();
    addEventListener("pagehide", save);
    return () => {
      mounted.current = false;
      save();
      removeEventListener("pagehide", save);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => flushRef.current(), 400);
    return () => clearTimeout(timer);
  }, [draft]);
  function change(next: typeof draft) {
    if (new TextEncoder().encode(next.text).byteLength > 48000 ||
        new TextEncoder().encode(JSON.stringify(next)).byteLength > 65536) {
      setNotice("成果物はUTF-8で48KiBまでです。直前の内容を保持しています。");
      return;
    }
    latest.current = next;
    dirty.current = true;
    setDraft(next);
    setNotice("編集中…");
  }
  function download() {
    flush();
    const url = URL.createObjectURL(
      new Blob([draft.text], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = stage.file;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="workflow-editor">
      <h3>{stage.title}</h3>
      <p>{stage.goal}</p>
      <label htmlFor="workflow-artifact">自分で作る成果物 · {stage.file}</label>
      <textarea
        id="workflow-artifact"
        value={draft.text}
        disabled={!!initial.error}
        spellCheck={false}
        rows={13}
        onChange={(event) =>
          change(editWorkflowDraft(draft, event.target.value))
        }
        onBlur={flush}
      />
      <div className="workflow-actions">
        <button type="button" onClick={download}>
          現在の成果物を保存 ↓
        </button>
        <a href="/learn?section=backup">学習記録ごとバックアップ →</a>
      </div>
      <p role="status" className="workflow-save">
        {notice || "記入すると自動保存します。"}
      </p>
      <details className="workflow-example">
        <summary>書いた後で、回答例と観点を確かめる</summary>
        <p>{stage.example}</p>
      </details>
      <fieldset>
        <legend>
          自己レビュー {draft.checked.filter(Boolean).length} /{" "}
          {stage.checks.length}
        </legend>
        {stage.checks.map((text, i) => (
          <label key={text}>
            <input
              type="checkbox"
              disabled={!!initial.error}
              checked={draft.checked[i]}
              onChange={(event) =>
                change({
                  ...draft,
                  checked: draft.checked.map((value, n) =>
                    n === i ? event.target.checked : value,
                  ),
                })
              }
            />
            {text}
          </label>
        ))}
      </fieldset>
      <p className="workflow-save">
        成果物を編集すると自己レビューをやり直せます。実行結果・テストの合否・リリース承認は、手元で確かめて記録してください。
      </p>
    </section>
  );
}

export default function WorkflowView({
  search,
  navigate,
}: {
  search: string;
  navigate: (href: string) => void;
}) {
  const [course, setCourse] = useState<WorkflowCourse | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    async function load() {
      const response = await fetch("/learning-v2/workflow.json", {
        signal: controller.signal,
      });
      if (!response.ok) throw Error("実務教材を取得できません。");
      const raw = await response.text();
      if (raw.length > 64000) throw Error("実務教材のサイズを確認できません。");
      const parsed = validateWorkflow(JSON.parse(raw));
      if (!controller.signal.aborted) setCourse(parsed);
    }
    load().catch((error) => {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "教材を読み取れません。",
        );
    });
    return () => controller.abort();
  }, [retry]);
  const requested = new URLSearchParams(search).get("stage");
  const index = Math.max(
    0,
    course?.stages.findIndex((stage) => stage.id === requested) ?? 0,
  );
  const stage = course?.stages[index];
  const open = (id: string) =>
    navigate(
      "/learn?" + new URLSearchParams({ section: "workflow", stage: id }),
    );
  return (
    <main className="workflow-page">
      <header>
        <h2>実務の流れを、成果物を作って学ぶ</h2>
        <p>要件からリリースまで。どの工程からでも始められます。</p>
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            読み直す
          </button>
        </p>
      )}
      {!course && !error && <p role="status">実務教材を読み込んでいます…</p>}
      {course && stage && (
        <>
          <label className="workflow-stage-picker">
            この工程から始める
            <select
              value={stage.id}
              onChange={(event) => open(event.target.value)}
            >
              {course.stages.map((entry, i) => (
                <option key={entry.id} value={entry.id}>
                  {i + 1}. {entry.title}
                </option>
              ))}
            </select>
          </label>
          <nav className="workflow-stages" aria-label="開発工程">
            {course.stages.map((entry, i) => (
              <button
                type="button"
                key={entry.id}
                aria-current={stage.id === entry.id ? "step" : undefined}
                onClick={() => open(entry.id)}
              >
                <span>{i + 1}</span>
                {entry.title}
              </button>
            ))}
          </nav>
          <details className="workflow-brief" open={index === 0}>
            <summary>共通のサンプル仕様 · {course.title}</summary>
            <p>{course.brief}</p>
            <p>
              各工程はこの共通仕様でも、自分が前の工程で作った成果物でも進められます。自分の設計を使う場合は、要件ID・入出力・期待値の整合を確認してください。
            </p>
            <a href="/learn?section=projects&lang=java">Javaの実装課題 →</a>　
            <a href="/learn?section=projects&lang=rust">Rustの実装課題 →</a>
          </details>
          <StageEditor key={stage.id} stage={stage} index={index} />
          <div className="workflow-actions">
            {index > 0 && (
              <button
                type="button"
                onClick={() => open(course.stages[index - 1].id)}
              >
                ← 前の工程
              </button>
            )}
            {index + 1 < course.stages.length && (
              <button
                type="button"
                onClick={() => open(course.stages[index + 1].id)}
              >
                次の工程 →
              </button>
            )}
            <a href="/learn?section=source">Java・Rustの実装を読む →</a>
          </div>
        </>
      )}
    </main>
  );
}
