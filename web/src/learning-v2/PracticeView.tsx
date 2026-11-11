import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  loadProgress,
  projectDraftKey,
  saveDraft,
  saveProgress,
} from "./progress";
import {
  INCIDENTS,
  MUTANTS,
  emptyPractice,
  evaluateSuite,
  parsePractice,
  practiceReport,
  replayConcurrency,
  type ContractCase,
  type PracticeDraft,
  type RaceAction,
} from "./practiceLab";
import "./workflow.css";
import "./practice-lab.css";

const JpaWorkshop = lazy(() => import("./JpaWorkshop"));

const KEY = projectDraftKey("java:mission-practice-lab", "1", 0);
function usePractice() {
  const [initial] = useState(() => {
    try {
      const stored = loadProgress(localStorage);
      if (!stored.writable)
        throw Error(stored.error ?? "記録を読み取れません。");
      return {
        draft: parsePractice(stored.state.drafts[KEY]?.content),
        stamp: stored.state.drafts[KEY]?.updatedAt ?? 0,
        error: "",
      };
    } catch (e) {
      return {
        draft: emptyPractice(),
        stamp: 0,
        error: e instanceof Error ? e.message : "記録を読み取れません。",
      };
    }
  });
  const [draft, setDraft] = useState(initial.draft),
    [notice, setNotice] = useState(initial.error);
  const latest = useRef(draft),
    dirty = useRef(false),
    stamp = useRef(initial.stamp),
    mounted = useRef(true);
  function flush() {
    if (!dirty.current || initial.error) return;
    try {
      const stored = loadProgress(localStorage);
      if (!stored.writable)
        throw Error(stored.error ?? "記録を読み取れません。");
      if ((stored.state.drafts[KEY]?.updatedAt ?? 0) > stamp.current)
        throw Error(
          "別のタブで実務演習が更新されました。現在の内容をファイルへ保存してから、再読み込みしてください。",
        );
      const next = saveDraft(stored.state, KEY, JSON.stringify(latest.current));
      const result = saveProgress(localStorage, next);
      if (!result.ok) throw Error(result.error ?? "保存できません。");
      stamp.current = next.drafts[KEY].updatedAt;
      dirty.current = false;
      if (mounted.current) setNotice("このブラウザに保存しました。");
    } catch (e) {
      if (mounted.current)
        setNotice(e instanceof Error ? e.message : "保存できません。");
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
  function update(next: PracticeDraft) {
    if (initial.error) return;
    try {
      const parsed = parsePractice(JSON.stringify(next));
      latest.current = parsed;
      dirty.current = true;
      setDraft(parsed);
      setNotice("編集中…");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "直前の内容を保持しました。");
    }
  }
  return { draft, update, flush, notice, blocked: !!initial.error };
}

function TestDesigner({
  cases,
  change,
  blocked,
}: {
  cases: ContractCase[];
  change: (cases: ContractCase[]) => void;
  blocked: boolean;
}) {
  const [result, setResult] = useState<ReturnType<typeof evaluateSuite> | null>(
    null,
  );
  const [exportNotice, setExportNotice] = useState(""),
    [exporting, setExporting] = useState(false);
  async function exportHttp() {
    setExporting(true);
    try {
      const [{ makeHttpSuiteArchive }, { default: runner }] = await Promise.all(
        [
          import("./httpSuiteArchive"),
          import("../../practical/check_contract.py?raw"),
        ],
      );
      const bytes = makeHttpSuiteArchive(cases, runner);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-http-contract-tests.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice(
        "試験項目JSONとPythonの実HTTP確認スクリプトを保存しました。READMEで契約と接続先を確認してから、手元で実行してください。",
      );
    } catch (e) {
      setExportNotice(
        e instanceof Error ? e.message : "試験を保存できません。",
      );
    } finally {
      setExporting(false);
    }
  }
  function edit(next: ContractCase[]) {
    setResult(null);
    change(next);
  }
  function field(i: number, patch: Partial<ContractCase>) {
    edit(cases.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }
  return (
    <section aria-labelledby="contract-title">
      <h3 id="contract-title">自分のテストで、不具合を見つける</h3>
      <p>
        先に期待値を決めてから実行します。正しいモデルで全項目が一致した場合だけ、用意した
        {MUTANTS.length}種類の不具合を検出できるか確認します。
      </p>
      <details className="workflow-brief">
        <summary>今回のAPI契約とデータを見る</summary>
        <p>
          GET
          /api/books/&#123;id&#125;。ASCII数字のみ、先頭0は許可。1〜2,147,483,647。登録データは1＝Java、2＝Rust、versionは1。不正IDは400、未登録は404、保存先停止は500。入力検証は保存先接続より先に行う。エラーには一般的な説明と文字列のrequestIdだけを出し、SQLや内部パスを出さない。
        </p>
        <p>
          これは仕様を決めた練習モデルです。別のAPIの仕様や実際のHTTPルーティングには自動で当てはまりません。
        </p>
        <a href="/learn?section=workflow&stage=basic">基本設計を自分で書く →</a>
      </details>
      <fieldset className="lab-cases" disabled={blocked}>
        <legend>自分で設計する試験項目 · {cases.length} / 12</legend>
        {cases.map((c, i) => (
          <details key={i} className="lab-case" open={i === cases.length - 1}>
            <summary>
              項目{i + 1} · {c.name || "目的を記入"} · 期待{c.status}
            </summary>
            <div className="lab-inputs">
              <label>
                確認したい条件
                <input
                  maxLength={80}
                  value={c.name}
                  onChange={(e) => field(i, { name: e.target.value })}
                />
              </label>
              <label>
                入力ID（空文字も試せます）
                <input
                  maxLength={80}
                  value={c.id}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => field(i, { id: e.target.value })}
                />
              </label>
              <label>
                保存先
                <select
                  value={c.repository}
                  onChange={(e) =>
                    field(i, {
                      repository: e.target.value as ContractCase["repository"],
                    })
                  }
                >
                  <option value="ready">利用可能</option>
                  <option value="down">停止中</option>
                </select>
              </label>
              <label>
                期待するHTTP状態
                <select
                  value={c.status}
                  onChange={(e) => field(i, { status: Number(e.target.value) })}
                >
                  {[200, 400, 404, 500].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                期待する書名（空欄なら検査しない）
                <input
                  maxLength={80}
                  value={c.title}
                  onChange={(e) => field(i, { title: e.target.value })}
                />
              </label>
              <label className="lab-check">
                <input
                  type="checkbox"
                  checked={c.successShape ?? false}
                  onChange={(e) => field(i, { successShape: e.target.checked })}
                />
                成功JSONのid・versionも確認（共通の初期データ）
              </label>
              <label className="lab-check">
                <input
                  type="checkbox"
                  checked={c.safeError}
                  onChange={(e) => field(i, { safeError: e.target.checked })}
                />
                エラー本文に内部情報がなく、文字列のrequestIdがあることも検査
              </label>
            </div>
            <button
              disabled={cases.length === 1}
              onClick={() => edit(cases.filter((_, n) => n !== i))}
            >
              この項目を外す
            </button>
          </details>
        ))}
        <div className="workflow-actions">
          <button
            disabled={cases.length >= 12}
            onClick={() =>
              edit([
                ...cases,
                {
                  name: "",
                  id: "",
                  repository: "ready",
                  status: 400,
                  title: "",
                  safeError: false,
                },
              ])
            }
          >
            試験項目を追加
          </button>
          <button onClick={() => setResult(evaluateSuite(cases))}>
            モデルでテストを実行
          </button>
        </div>
      </fieldset>
      <div className="workflow-actions">
        <button
          disabled={exporting || blocked}
          onClick={() => void exportHttp()}
        >
          {exporting
            ? "試験をまとめています…"
            : "自分の試験を実HTTPで確認するZIP ↓"}
        </button>
        <a href="/learn?section=workflow&stage=integration">
          実装との仕様差を確認する →
        </a>
      </div>
      {exportNotice && <p role="status">{exportNotice}</p>}
      {result && (
        <div className="lab-result" role="status">
          <h4>
            基準モデルとの照合 ·{" "}
            {result.baseline.filter((r) => !r.errors.length).length} /{" "}
            {cases.length}一致
          </h4>
          <ol>
            {result.baseline.map((r, i) => (
              <li key={i}>
                <strong>{r.test.name || `項目${i + 1}`}</strong>：
                {r.errors.length ? r.errors.join(" / ") : "期待と一致"}
                <details>
                  <summary>モデル応答を見る</summary>
                  <pre>{JSON.stringify(r.response, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
          {result.valid ? (
            <>
              <h4>
                用意した不具合 ·{" "}
                {result.mutations.filter((m) => m.caughtBy.length).length} /{" "}
                {MUTANTS.length}種類を検出
              </h4>
              <ul>
                {result.mutations.map((m) => (
                  <li key={m.id}>
                    {m.title}：
                    {m.caughtBy.length
                      ? `項目${m.caughtBy.map((i) => i + 1).join("・")}で検出`
                      : "未検出。条件や検査対象を追加できないか考える"}
                  </li>
                ))}
              </ul>
              <p>
                全種類を検出しても、すべての不具合を防げる証明にはなりません。認証・文字コード・実DB・通信障害などは別の試験が必要です。
              </p>
            </>
          ) : (
            <p>
              不具合の検出件数は未判定です。まずAPI契約と期待値の食い違いを見直してください。
            </p>
          )}
        </div>
      )}
      <details className="workflow-example">
        <summary>手が止まったときのテスト観点</summary>
        <p>
          登録済み／未登録、数字でないID、上限の直後、保存先の障害、不正ID＋保存先障害、エラー本文の情報漏えい。0、上限値、先頭0も仕様と照合します。単に状態コードだけ見るテストで十分か考えてください。
        </p>
      </details>
      <p>
        <a href="/learn?section=workflow&stage=unit">
          この観点から試験項目書を作る →
        </a>
        　<a href="/learn?section=projects&lang=java">Javaで実際に試す →</a>　
        <a href="/learn?section=projects&lang=rust">Rustで実際に試す →</a>
      </p>
    </section>
  );
}

function ConcurrencyLab({
  draft,
  change,
  blocked,
}: {
  draft: PracticeDraft;
  change: (draft: PracticeDraft) => void;
  blocked: boolean;
}) {
  const [titleA, setTitleA] = useState("Java実践"),
    [titleB, setTitleB] = useState("Java設計");
  const result = replayConcurrency(draft.actions, draft.guarded);
  const add = (
    client: RaceAction["client"],
    operation: RaceAction["operation"],
  ) => {
    const title = (client === "A" ? titleA : titleB).trim();
    if (title && draft.actions.length < 20)
      change({
        ...draft,
        actions: [...draft.actions, { client, operation, title }],
      });
  };
  return (
    <section aria-labelledby="race-title">
      <h3 id="race-title">同じデータを2人で更新すると？</h3>
      <p>
        AとBが同じ版を読み、順番に保存する場面です。操作の順番を変えるか、同じ操作列でversion照合を切り替え、最終データを比べてください。
      </p>
      <fieldset disabled={blocked}>
        <legend>練習モデル · 最大20操作</legend>
        <label className="lab-check">
          <input
            type="checkbox"
            checked={draft.guarded}
            onChange={(e) => change({ ...draft, guarded: e.target.checked })}
          />
          更新元のversionを照合する（同じ操作列を再計算）
        </label>
        <div className="lab-clients">
          {(["A", "B"] as const).map((client) => (
            <div key={client}>
              <h4>編集者{client}</h4>
              <p>
                取得済みversion：{result.snapshots[client]?.version ?? "未取得"}
              </p>
              <label>
                次に保存するタイトル
                <input
                  value={client === "A" ? titleA : titleB}
                  maxLength={80}
                  onChange={(e) =>
                    client === "A"
                      ? setTitleA(e.target.value)
                      : setTitleB(e.target.value)
                  }
                />
              </label>
              <div className="workflow-actions">
                <button
                  disabled={draft.actions.length >= 20}
                  onClick={() => add(client, "read")}
                >
                  {client}: GETで読む
                </button>
                <button
                  disabled={
                    draft.actions.length >= 20 ||
                    !(client === "A" ? titleA : titleB).trim()
                  }
                  onClick={() => add(client, "save")}
                >
                  {client}: PUTで保存
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="workflow-actions">
          <button
            onClick={() =>
              change({
                ...draft,
                actions: [
                  { client: "A", operation: "read", title: "Java実践" },
                  { client: "B", operation: "read", title: "Java設計" },
                  { client: "A", operation: "save", title: "Java実践" },
                  { client: "B", operation: "save", title: "Java設計" },
                ],
              })
            }
          >
            4操作の更新競合を再現
          </button>
          <button
            disabled={!draft.actions.length}
            onClick={() =>
              change({ ...draft, actions: draft.actions.slice(0, -1) })
            }
          >
            1操作戻す
          </button>
          <button
            disabled={!draft.actions.length}
            onClick={() => change({ ...draft, actions: [] })}
          >
            操作を初めから
          </button>
        </div>
      </fieldset>
      <div className="lab-result">
        <h4>保存先の現在値</h4>
        <p>
          <strong>{result.book.title}</strong> / version={result.book.version}
        </p>
        <ol>
          {result.events.map((e, i) => (
            <li key={i}>
              <strong>
                {e.client} · {e.status ?? "未送信"}
              </strong>{" "}
              {e.detail}
            </li>
          ))}
        </ol>
        {!result.events.length && (
          <p>AとBでGETし、別々のタイトルを保存してみてください。</p>
        )}
      </div>
      <details className="workflow-example">
        <summary>実装で必要なこと・409の後にすること</summary>
        <p>
          このモデルはJSONのversionで照合し、競合は409にします。実DBでは UPDATE
          ... WHERE id=? AND version=?
          の更新件数で判定するなど、照合と更新の原子性が必要です。GETして確認した後、無条件UPDATEするだけでは防げません。
        </p>
        <p>
          409の後はGETし直し、他者の変更との差を見て再編集します。この練習ではA・Bの入力欄を自分で調整してください。ETagとIf-Matchを使う別のAPI設計では、不一致は通常412です。409と混同しないでください。
        </p>
        <a
          href="https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match"
          target="_blank"
          rel="noreferrer"
        >
          HTTP仕様：If-Match ↗
        </a>
      </details>
      <a href="/learn?section=workflow&stage=integration">
        再現手順を結合試験項目書に残す →
      </a>
    </section>
  );
}

function IncidentLab() {
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState<number | null>(null),
    [shown, setShown] = useState(false);
  const incident = INCIDENTS[index];
  return (
    <section aria-labelledby="incident-title">
      <h3 id="incident-title">ログから原因を切り分ける</h3>
      <label className="workflow-stage-picker">
        調べたい事象
        <select
          value={index}
          onChange={(e) => {
            setIndex(Number(e.target.value));
            setAnswer(null);
            setShown(false);
          }}
        >
          {INCIDENTS.map((s, i) => (
            <option key={s.id} value={i}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <h4>{incident.title}</h4>
      <p>{incident.symptom}</p>
      <p>
        症状だけで決めず、証跡を開いて仮説を絞ります。すべて架空の記録です。
      </p>
      {incident.evidence.map((e, i) => (
        <details className="workflow-example" key={`${incident.id}-${i}`}>
          <summary>証跡{i + 1}を見る</summary>
          <p>{e}</p>
        </details>
      ))}
      <fieldset>
        <legend>証跡に最も合う判断</legend>
        {incident.options.map((option, i) => (
          <label className="lab-check" key={`${incident.id}-${i}`}>
            <input
              type="radio"
              name="incident-answer"
              checked={answer === i}
              onChange={() => {
                setAnswer(i);
                setShown(false);
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <button disabled={answer === null} onClick={() => setShown(true)}>
        判断の根拠と再発防止を確かめる
      </button>
      {shown && (
        <div className="lab-result" role="status">
          <h4>
            {answer === incident.correct
              ? "用意した証跡と一致しています"
              : "仮説を見直す証跡があります"}
          </h4>
          <p>{incident.explanation}</p>
          <a href={`/learn?section=workflow&stage=${incident.stages}`}>
            この工程の成果物に対策を書く →
          </a>
        </div>
      )}
      <p>
        選択肢が一致しただけで障害対応力を証明したことにはなりません。下のメモに「再現条件・根拠・修正・回帰テスト」を自分の言葉で残してください。
      </p>
    </section>
  );
}

export default function PracticeView({
  search,
  navigate,
}: {
  search: string;
  navigate: (href: string) => void;
}) {
  const { draft, update, flush, notice, blocked } = usePractice();
  const requested = new URLSearchParams(search).get("lab");
  const lab =
    requested === "concurrency" ||
    requested === "incidents" ||
    requested === "jpa"
      ? requested
      : "testing";
  const [starterNotice, setStarterNotice] = useState(""),
    [starterBusy, setStarterBusy] = useState(false);
  async function starter() {
    setStarterBusy(true);
    try {
      const { fetchWorkplaceArchive } = await import("./workplaceArchive");
      const data = await fetchWorkplaceArchive();
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(data).buffer], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "workplace-java-rust-starter.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStarterNotice(
        "開始コード・固定テスト・回答例を保存しました。開始状態のTODOによる失敗を確認してから、自分で実装します。",
      );
    } catch (e) {
      setStarterNotice(
        e instanceof Error ? e.message : "開始ファイルを取得できません。",
      );
    } finally {
      setStarterBusy(false);
    }
  }
  function download() {
    flush();
    const url = URL.createObjectURL(
      new Blob([practiceReport(draft)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "practice-lab-report.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="workflow-page practice-page">
      <header>
        <h2>実務演習室</h2>
        <p>テストを設計する。競合を再現する。証拠から原因を調べる。</p>
        <p className="workflow-save">
          テスト設計・同時更新はブラウザ内のモデルで試せます。Java/RustやHibernate/JPAの実コードは、開始ZIPを手元へ展開して検証します。
        </p>
      </header>
      <nav className="workflow-stages" aria-label="実務演習の種類">
        {[
          ["testing", "テスト設計"],
          ["concurrency", "同時更新"],
          ["incidents", "障害調査"],
          ["jpa", "Hibernate/JPA"],
        ].map(([id, title]) => (
          <button
            key={id}
            aria-current={lab === id ? "page" : undefined}
            onClick={() => navigate(`/learn?section=practice-lab&lab=${id}`)}
          >
            {title}
          </button>
        ))}
      </nav>
      {blocked && (
        <p role="alert">
          {notice} 元の記録は上書きしません。
          <a href="/learn?section=backup">バックアップから確認する →</a>
        </p>
      )}
      {lab === "testing" ? (
        <TestDesigner
          cases={draft.cases}
          change={(cases) => update({ ...draft, cases })}
          blocked={blocked}
        />
      ) : lab === "concurrency" ? (
        <ConcurrencyLab draft={draft} change={update} blocked={blocked} />
      ) : lab === "jpa" ? (
        <Suspense fallback={<p>JPA教材を準備しています…</p>}>
          <JpaWorkshop />
        </Suspense>
      ) : (
        <IncidentLab />
      )}
      <section className="workflow-editor">
        <h3>調査メモ・実コードでの確認結果</h3>
        <p>
          再現手順、期待と実際の差、根拠、修正方針、次に確認するテストを残します。会社の情報や実在する個人情報は入力しないでください。
        </p>
        <label htmlFor="practice-notes">自分の記録 · 最大8,000文字</label>
        <textarea
          id="practice-notes"
          rows={6}
          maxLength={8000}
          value={draft.notes}
          disabled={blocked}
          onChange={(e) => update({ ...draft, notes: e.target.value })}
          onBlur={flush}
        />
      </section>
      <div className="workflow-actions">
        <button onClick={download}>試験項目・再現ログ・メモを保存 ↓</button>
        <a href="/learn?section=backup">学習記録をバックアップ →</a>
      </div>
      <p role="status" className="workflow-save">
        {notice ||
          "記入した試験項目と操作列・メモを、このブラウザに自動保存します。"}
      </p>
      <p>
        <a href="/learn?section=workflow">
          要件定義からリリースまで成果物を作る →
        </a>
      </p>
      <details className="workflow-example">
        <summary>次はJava・Rustの実コードで確かめる</summary>
        <p>
          ID検証とversion照合を自分で実装する小課題です。JavaはJDK
          17以上のみ、Rustは外部crate依存なし。メモリ内Repositoryの単体テストであり、HTTP・実DBは別の小プロジェクトで確かめます。
        </p>
        <p>
          開始時はTODOのためテストが失敗します。完成例の同梱テストはJava
          8件、Rust 7件。ZIP内のREADMEから実行してください。
        </p>
        <button disabled={starterBusy} onClick={() => void starter()}>
          {starterBusy
            ? "課題を準備しています…"
            : "Java・Rustの開始コードとテストをZIP保存 ↓"}
        </button>
        {starterNotice && <p role="status">{starterNotice}</p>}
      </details>
    </main>
  );
}
