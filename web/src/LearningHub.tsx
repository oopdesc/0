import { lazy, Suspense, useEffect, useState } from "react";
import type { SavedState } from "./state";
import { requestTrace } from "./request-flow";
import { store, type Route } from "./arena/orrery/core/appStore";
import "./learning-hub.css";
const Basics = lazy(() => import("./Learning"));
const Lab = lazy(() =>
  import("./arena/orrery/App").then((m) => ({ default: m.App })),
);
const Source = lazy(() => import("./Secondary"));
const sections = [
  ["flow", "処理の全体像"],
  ["practice", "Java・Rustの演習"],
  ["source", "Eclipseとソース"],
  ["references", "日本語の資料"],
] as const;
function RequestFlow() {
  const [input, setInput] = useState("1"),
    [trace, setTrace] = useState(() => requestTrace("1")),
    [step, setStep] = useState(0);
  const current = trace.steps[step];
  return (
    <main className="hub-content">
      <div className="flow-heading">
        <h2>ブラウザからDBへ、そして画面へ。</h2>
        <p>
          本のIDでデータを探す、小さなリクエストです。最初は「1」、次に「3」や「abc」を試して、通る経路を比べてください。
        </p>
        <p className="hub-note">
          ブラウザ内の練習モデルです。実際のDBへ接続したり、会社のデータを送ったりはしません。
        </p>
      </div>
      <form
        className="flow-input"
        onSubmit={(e) => {
          e.preventDefault();
          setTrace(requestTrace(input));
          setStep(0);
        }}
      >
        <label>
          本のID
          <input
            value={input}
            maxLength={12}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="primary">流れを追う</button>
        <span>練習用データ：1＝Java、2＝Rust</span>
      </form>
      <div className="flow-route" aria-label="処理の経路">
        {[
          "ブラウザ",
          "HTTP",
          "Java",
          "JDBC",
          "DB",
          "Java",
          "HTTP",
          "ブラウザ",
        ].map((s, i) => (
          <span key={i}>
            {s}
            {i < 7 ? " →" : ""}
          </span>
        ))}
      </div>
      <div className="flow-layout">
        <nav aria-label="処理の段階">
          {trace.steps.map((s, i) => (
            <button
              key={s.name}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <small>{String(i + 1).padStart(2, "0")}</small>
              {s.name}
            </button>
          ))}
        </nav>
        <article className="flow-detail">
          <span className="eyebrow">
            {step + 1} / {trace.steps.length}
          </span>
          <h3>{current.name}</h3>
          <p>{current.note}</p>
          <pre>
            <code>{current.code}</code>
          </pre>
          <div className="flow-controls">
            <button disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← 前へ
            </button>
            <button
              disabled={step === trace.steps.length - 1}
              onClick={() => setStep(step + 1)}
            >
              次へ →
            </button>
          </div>
        </article>
      </div>
      <p className="flow-result" role="status">
        応答：{trace.status} · DB照会：{trace.dbQueried ? "あり" : "なし"} ·{" "}
        {JSON.stringify(trace.body)}
      </p>
      <details className="hub-note">
        <summary>実装するときに確認すること</summary>
        <p>
          ブラウザの開発者ツールでリクエストと応答を確認し、EclipseではController
          → Service → Repository →
          JDBCの順にブレークポイントを置きます。DBの行がどこでJavaの値になり、どこでJSONへ変わるかを追ってください。上のコードは各層の役割を説明する抜粋です。
        </p>
        <a href="/learn?section=source">Eclipseと実装の入口へ →</a>
      </details>
    </main>
  );
}
export default function LearningHub({
  state,
  update,
  search,
  path,
}: {
  state: SavedState;
  update: (s: SavedState) => void;
  search: string;
  path: string;
}) {
  const params = new URLSearchParams(search);
  const requested =
    path === "/lab"
      ? "practice"
      : path === "/code"
        ? "source"
        : params.get("section") || (params.has("track") ? "practice" : "flow");
  const section = sections.some(([id]) => id === requested)
    ? requested
    : "flow";
  const [mode, setMode] = useState(
    params.get("mode") === "code" || path === "/lab" ? "code" : "basics",
  );
  const [exercise, setExercise] = useState<Route>("lab");
  useEffect(() => {
    setMode(
      new URLSearchParams(search).get("mode") === "code" || path === "/lab"
        ? "code"
        : "basics",
    );
  }, [search, path]);
  useEffect(() => {
    if (section === "practice" && mode === "code") store.navigate(exercise);
  }, [section, mode, exercise]);
  return (
    <div className="learning-hub">
      <section className="hub-heading">
        <span className="eyebrow">ひとつの場所で、仕組みから実装まで</span>
        <h1>Java・Rustの学習</h1>
        <p>処理の流れを追い、コードを動かし、必要な仕様を日本語で調べる。</p>
        <nav aria-label="学習の内容">
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={"/learn?section=" + id}
              aria-current={section === id ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </section>
      {section === "flow" ? (
        <RequestFlow />
      ) : section === "references" ? (
        <main className="hub-content">
          <h2>日本語で読む資料</h2>
          <p>
            JavaはOracle公式の日本語API、Rustは公式日本語の実例集と入門書の日本語訳から始められます。
          </p>
          <div className="hub-references">
            {[
              [
                "Java 21 API・日本語",
                "Oracle公式。クラスやメソッドの仕様を調べる資料です。日本語版は機械翻訳です。",
                "https://docs.oracle.com/javase/jp/21/docs/api/index.html",
              ],
              [
                "Rust by Example・日本語",
                "Rust公式サイトの日本語実例集。短いコードを動かしながら読めます。",
                "https://doc.rust-lang.org/rust-by-example/ja/",
              ],
              [
                "Rust入門書・日本語訳",
                "The Rust Programming Languageのコミュニティ翻訳です。翻訳の版と最新仕様には差があるため、必要に応じて原文も参照してください。",
                "https://doc.rust-jp.rs/book-ja/",
              ],
              [
                "Rust公式入門書・原文",
                "日本語訳で分からない部分や、現在の仕様を確認するときの英語原文です。",
                "https://doc.rust-lang.org/book/",
              ],
            ].map(([title, text, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <h3>{title} ↗</h3>
                <p>{text}</p>
              </a>
            ))}
          </div>
        </main>
      ) : (
        <Suspense
          fallback={<p className="hub-content">教材を読み込んでいます…</p>}
        >
          {section === "source" ? (
            <Source path="/code" state={state} update={update} />
          ) : (
            <>
              <section className="hub-practice-controls">
                <button
                  aria-pressed={mode === "basics"}
                  onClick={() => setMode("basics")}
                >
                  基礎・HTTPと復習
                </button>
                <button
                  aria-pressed={mode === "code"}
                  onClick={() => setMode("code")}
                >
                  コードを編集して実験
                </button>
                {mode === "code" && (
                  <label>
                    演習の内容
                    <select
                      aria-label="演習の内容"
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value as Route)}
                    >
                      {[
                        ["lab", "自由にコードを書く"],
                        ["learn", "段階別の課題"],
                        ["errors", "誤りの記録"],
                        ["galaxy", "概念のつながり"],
                        ["review", "思い出す練習"],
                        ["settings", "演習の設定"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
              {mode === "code" ? (
                <div className="hub-code-lab">
                  <Lab />
                </div>
              ) : (
                <Basics state={state} update={update} search={search} />
              )}
            </>
          )}
        </Suspense>
      )}
    </div>
  );
}
