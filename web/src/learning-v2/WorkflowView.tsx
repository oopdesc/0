import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { loadProgress, saveDraft, saveProgress } from "./progress";
import {
  editWorkflowDraft,
  readWorkflowDraft,
  validateWorkflow,
  workflowKey,
  workflowFiles,
  workflowStatus,
  type WorkflowCourse,
  type WorkflowStage,
} from "./workflow";
import "./workflow.css";

function StageEditor({
  stage,
  index,
  onSaved,
  ref,
}: {
  stage: WorkflowStage;
  index: number;
  onSaved: () => void;
  ref: Ref<{ flush: () => boolean }>;
}) {
  const [initial] = useState(() => {
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable)
        throw Error(saved.error ?? "学習記録を読み取れません。");
      return {
        raw: saved.state.drafts[workflowKey(index)]?.content,
        draft: readWorkflowDraft(
          saved.state.drafts[workflowKey(index)]?.content,
          stage,
        ),
        error: "",
      };
    } catch (error) {
      return {
        raw: undefined,
        draft: readWorkflowDraft(undefined, stage),
        error:
          error instanceof Error ? error.message : "保存を読み取れません。",
      };
    }
  });
  const [draft, setDraft] = useState(initial.draft);
  const latest = useRef(draft);
  const savedRaw = useRef(initial.raw);
  const dirty = useRef(false);
  const mounted = useRef(true);
  const [notice, setNotice] = useState(initial.error);
  function flush() {
    if (initial.error) return false;
    if (!dirty.current) return true;
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable)
        throw Error(saved.error ?? "既存の記録を読み取れません。");
      if (saved.state.drafts[workflowKey(index)]?.content !== savedRaw.current)
        throw Error(
          "別の画面でこの工程が更新されました。上書きせず編集中の内容を保持しています。まず現在の成果物を保存し、ページを読み直してください。",
        );
      const content = JSON.stringify(latest.current);
      const next = saveDraft(saved.state, workflowKey(index), content);
      const result = saveProgress(localStorage, next);
      if (!result.ok) throw Error(result.error ?? "保存できません。");
      savedRaw.current = content;
      dirty.current = false;
      if (mounted.current) {
        setNotice("このブラウザに保存しました。");
        onSaved();
      }
      return true;
    } catch (error) {
      if (mounted.current)
        setNotice(error instanceof Error ? error.message : "保存できません。");
      return false;
    }
  }
  useImperativeHandle(ref, () => ({ flush }));
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
    if (
      new TextEncoder().encode(next.text).byteLength > 48000 ||
      new TextEncoder().encode(JSON.stringify(next)).byteLength > 65536
    ) {
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
  const [exportNotice, setExportNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const activeEditor = useRef<{ flush: () => boolean }>(null);
  const [status, setStatus] = useState<ReturnType<typeof workflowStatus>>([]);
  const [statusError, setStatusError] = useState("");
  const [lastStage] = useState(() => {
    try {
      return localStorage.getItem("0.workflow.last-stage") ?? "";
    } catch {
      return "";
    }
  });
  const refreshStatus = useCallback(() => {
    if (!course) return;
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable)
        throw Error(saved.error ?? "学習記録を読み取れません。");
      setStatus(workflowStatus(course, saved.state.drafts));
      setStatusError("");
    } catch (e) {
      setStatusError(
        e instanceof Error ? e.message : "記入状況を読み取れません。",
      );
    }
  }, [course]);
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
  const requested = new URLSearchParams(search).get("stage") ?? lastStage;
  const index = Math.max(
    0,
    course?.stages.findIndex((stage) => stage.id === requested) ?? 0,
  );
  const stage = course?.stages[index];
  useEffect(() => {
    refreshStatus();
    addEventListener("storage", refreshStatus);
    addEventListener("focus", refreshStatus);
    return () => {
      removeEventListener("storage", refreshStatus);
      removeEventListener("focus", refreshStatus);
    };
  }, [refreshStatus, index]);
  useEffect(() => {
    if (stage)
      try {
        localStorage.setItem("0.workflow.last-stage", stage.id);
      } catch {
        /* Resume is optional; drafts have their own save notice. */
      }
  }, [stage?.id]);
  const open = (id: string) =>
    navigate(
      "/learn?" + new URLSearchParams({ section: "workflow", stage: id }),
    );
  async function exportAll() {
    if (!course) return;
    setExporting(true);
    try {
      if (!activeEditor.current?.flush())
        throw Error(
          "現在の工程を保存できていません。先に『現在の成果物を保存』で編集中の内容を保管し、保存メッセージを確認してください。",
        );
      const saved = loadProgress(localStorage);
      if (!saved.writable) throw Error(saved.error ?? "記録を読み取れません。");
      const files = workflowFiles(course, saved.state.drafts);
      const { zipSync, strToU8 } = await import("fflate");
      const zip = zipSync(
        Object.fromEntries(
          Object.entries(files).map(([name, text]) => [name, strToU8(text)]),
        ),
      );
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(zip).buffer], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "development-workflow-artifacts.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice(
        "8工程の成果物と記入状況を保存しました。未編集の工程はテンプレートを含みます。",
      );
    } catch (e) {
      setExportNotice(
        e instanceof Error ? e.message : "成果物を保存できません。",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <main className="workflow-page">
      <header>
        <h2>実務の流れを、成果物を作って学ぶ</h2>
        <p>要件からリリースまで。どの工程からでも始められます。</p>
        <p>
          <a href="/learn?section=practice-lab">
            テスト・同時更新・障害調査を実務演習室で試す →
          </a>
        </p>
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
                  {status[i]?.reviewed
                    ? " · 自己レビュー済"
                    : status[i]?.written
                      ? " · 記入あり"
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="workflow-progress" aria-label="成果物の記入状況">
            <p>
              記入あり {status.filter((s) => s.written).length}/8工程 ·
              自己レビュー済 {status.filter((s) => s.reviewed).length}/8工程
            </p>
            <p className="workflow-save">
              自己レビューは自分の確認です。テスト合格や実務経験の認定とは別です。前回開いた工程から再開できます。
            </p>
            {statusError && <p role="status">{statusError}</p>}
            {status.length > 0 && status.some((s) => !s.reviewed) && (
              <button
                type="button"
                onClick={() => {
                  const ordered = [
                    ...status.slice(index + 1),
                    ...status.slice(0, index + 1),
                  ];
                  const next = ordered.find((s) => !s.reviewed);
                  if (next) open(next.id);
                }}
              >
                次の未レビュー工程へ →
              </button>
            )}
          </div>
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
          <details className="workflow-brief">
            <summary>教材ごとの仕様・ポートの違いを確認する</summary>
            <div className="workflow-contract-table">
              <table>
                <caption>共通演習への改修前に比較する契約</caption>
                <thead>
                  <tr>
                    <th>教材</th>
                    <th>IDの契約</th>
                    <th>version</th>
                    <th>実HTTPのポート</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>この共通演習・新しい単体課題</th>
                    <td>1〜2,147,483,647。先頭0可</td>
                    <td>あり</td>
                    <td>モデル・単体のみ</td>
                  </tr>
                  <tr>
                    <th>Javaの小課題ZIP（H2）</th>
                    <td>先頭0なし、1〜9桁</td>
                    <td>なし</td>
                    <td>18423</td>
                  </tr>
                  <tr>
                    <th>Java/SQLite参考実装</th>
                    <td>先頭0なし、1〜6桁</td>
                    <td>あり</td>
                    <td>18080</td>
                  </tr>
                  <tr>
                    <th>Rust/SQLite小課題</th>
                    <td>先頭0なし、1〜6桁</td>
                    <td>あり</td>
                    <td>18082</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              契約が異なる教材を同じ期待値で採点しないでください。共通仕様へ変更する場合は、要件・設計・コード・テストを一緒に変更します。ポートは学習用の既定値です。
            </p>
            <p>
              初期データにも違いがあります。共通モデルのID=1は「Java」、Java/H2は「Java入門」、Java/SQLiteとRust/SQLiteは「JavaでHTTPを学ぶ」です。エラーのrequestIdは共通モデルとJava/SQLiteでは文字列、Rust/SQLiteでは数値、Java/H2では返しません。この差を要件・初期データ・テストへ記録してください。
            </p>
            <a
              href="https://github.com/oopdesc/0/tree/main/projects/java/book-api-http"
              target="_blank"
              rel="noreferrer"
            >
              Java/SQLiteの参考実装 ↗
            </a>
          </details>
          <StageEditor
            ref={activeEditor}
            key={stage.id}
            stage={stage}
            index={index}
            onSaved={refreshStatus}
          />
          <div className="workflow-actions">
            <button disabled={exporting} onClick={() => void exportAll()}>
              {exporting
                ? "成果物をまとめています…"
                : "8工程の成果物をまとめてZIP保存 ↓"}
            </button>
          </div>
          {exportNotice && <p role="status">{exportNotice}</p>}
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
