import { questionCompleted } from "../learning-v2/journey-state";
import { TOPIC_MAP } from "./topics";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Problem } from "./schema";
import {
  MISCONCEPTION_LABEL,
  QUESTION_LABEL,
  judgeLegacyAnswer,
} from "./schema";
import {
  applyAttempt,
  applyTransfer,
  type ProblemRecord,
  type ProgressState,
} from "./store";
import { getProblem } from "./index";
import { runProblem, describeFailure } from "./runners";
import "./player.css";

type Phase = "predict" | "committed" | "why" | "patch" | "retry" | "transfer" | "done";

export interface PlayerProps {
  problem: Problem;
  record: ProblemRecord | undefined;
  state: ProgressState;
  onChange: (state: ProgressState) => void;
  onExit: () => void;
}

/** Result of "what actually happened". */
interface Actual {
  lines: string[];
  label: string;
}

function keywordSet(language: string): Set<string> {
  const words =
    language === "java"
      ? [
          "public", "private", "protected", "class", "interface", "abstract", "final",
          "static", "void", "new", "return", "if", "else", "for", "while", "switch",
          "case", "break", "continue", "extends", "implements", "throws", "try",
          "catch", "finally", "throw", "import", "package", "enum", "record", "sealed",
          "instanceof", "var",
        ]
      : [
          "fn", "let", "mut", "const", "static", "struct", "enum", "trait", "impl",
          "pub", "use", "match", "if", "else", "for", "while", "loop", "break",
          "continue", "return", "move", "ref", "as", "in", "where", "type",
        ];
  return new Set(words);
}

/** Highlight a code block. Display only: the highlighted text is plain text. */
function highlight(code: string, language: string) {
  const kw = keywordSet(language);
  const parts: Array<[string, string]> = [];
  const re = /(\/\/[^\n]*|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) parts.push([code.slice(last, m.index), ""]);
    if (m[1]) parts.push([m[1], /^(\/\/|#)/.test(m[1]) ? "tok-com" : "tok-str"]);
    else if (m[2]) {
      const cls = kw.has(m[2]!) ? "tok-kw" : /^[A-Z]/.test(m[2]!) ? "tok-typ" : "tok-fn";
      parts.push([m[2]!, cls]);
    } else parts.push([m[3]!, "tok-num"]);
    last = re.lastIndex;
  }
  if (last < code.length) parts.push([code.slice(last), ""]);
  return parts.map(([text, cls], i) =>
    cls ? (
      <span key={i} className={cls}>
        {text}
      </span>
    ) : (
      <span key={i}>{text}</span>
    ),
  );
}

function highlightBlanks(code: string, language: string) {
  return code.split(/(____)/g).map((segment, i) =>
    segment === "____" ? (
      <span key={i} className="lp-blank">
        ____
      </span>
    ) : (
      <span key={i}>{highlight(segment, language)}</span>
    ),
  );
}

function CodeBlock({
  code,
  language,
  blanks = false,
}: {
  code: string;
  language: string;
  blanks?: boolean;
}) {
  return (
    <pre className="lp-code" aria-label="コード">
      <code>{blanks ? highlightBlanks(code, language) : highlight(code, language)}</code>
    </pre>
  );
}

function actualFromExpected(problem: Problem): Actual | null {
  const expected = problem.expected;
  if (!expected) return null;
  if (expected.runtimeError) {
    return { lines: [`実行時例外 ${expected.runtimeError}`], label: "実行結果" };
  }
  if (expected.compiles !== undefined) {
    return {
      lines: expected.compiles
        ? ["コンパイルできる"]
        : [`コンパイルできない：${expected.compileError ?? "エラー"}`],
      label: "コンパイラの判定",
    };
  }
  if (expected.output) return { lines: expected.output, label: "実行結果" };
  if (expected.value !== undefined) return { lines: [expected.value], label: "期待する値" };
  return null;
}

export default function Player({ problem, record, state, onChange, onExit }: PlayerProps) {
  const [phase, setPhase] = useState<Phase>("predict");
  const [prediction, setPrediction] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [actual, setActual] = useState<Actual | null>(null);
  const [actualSource, setActualSource] = useState("検証済みの結果");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [hintStep, setHintStep] = useState(0);
  const [retryAnswer, setRetryAnswer] = useState("");
  const [transferAnswer, setTransferAnswer] = useState("");
  const [verdict, setVerdict] = useState<{ text: string; kind: "ok" | "bad" | "info" } | null>(null);
  const commitRef = useRef<HTMLButtonElement>(null);
  const runToken = useRef(0);
  const inFlight = useRef(false);
  const currentProblemId = useRef(problem.id);
  if (currentProblemId.current !== problem.id) {
    currentProblemId.current = problem.id;
    runToken.current += 1;
    inFlight.current = false;
  }
  useEffect(() => () => { runToken.current += 1; }, []);
  const leave = () => {
    runToken.current += 1;
    inFlight.current = false;
    onExit();
  };
  // Every panel that appears after a commit is focusable, so keyboard and screen
  // reader users land on the new content instead of the button that just vanished.
  const panels = useRef<Partial<Record<Phase, HTMLElement | null>>>({});
  const panelRef = (key: Phase) => (el: HTMLElement | null) => {
    panels.current[key] = el;
  };

  useEffect(() => {
    if (phase === "predict") return;
    panels.current[phase]?.focus();
  }, [phase]);

  const fallback = useMemo(() => actualFromExpected(problem), [problem]);
  const options = problem.prediction.options ?? [];
  const freeText = picked === null ? prediction : picked;
  const canCommit = (freeText ?? "").trim().length > 0 && !running;
  const hint = problem.hints[Math.min(hintStep, problem.hints.length - 1)];
  const transferProblem = problem.transfer ? getProblem(problem.transfer) : undefined;

  const commit = async () => {
    const value = freeText ?? "";
    if (!value.trim() || inFlight.current) return;
    inFlight.current = true;
    const token = ++runToken.current;
    const submittedProblem = problem.id;
    setRunning(true);
    setRunError("");
    let lines = fallback?.lines ?? [];
    let source = fallback ? `過去の検証記録（${problem.expected?.verifiedBy ?? "詳細不明"}）` : '未実行';
    let failure = '';
    try {
      const raw = await runProblem(problem.id, problem.language);
      if (raw !== null) {
        lines = raw.replace(/\n$/, "").split("\n");
        source =
          problem.language === "java" ? "TeaVM が実行した Java" : "WASM が実行した Rust";
        lines = lines.map((line) =>
          /^PANIC:(.+)$/.test(line) ? `実行時例外 ${line.slice(6)}` : line,
        );
      }
    } catch (error) {
      failure = describeFailure(error);
    }
    // 問題切替・画面離脱後の遅い結果は、表示・記録どちらにも反映しない。
    if (runToken.current !== token || currentProblemId.current !== submittedProblem) return;
    inFlight.current = false;
    setRunning(false);
    if (failure) setRunError(failure);
    setActual({ lines, label: fallback?.label ?? "実行結果" });
    setActualSource(source);
    const ok = judgeLegacyAnswer(problem, value, picked !== null);
    if (problem.answerKind !== 'code') {
      const next = applyAttempt(state, problem, {
        prediction: value,
        actual: lines.join("\n"),
        ok,
        blind: hintStep === 0,
      });
      onChange(next.state);
      if(ok) questionCompleted("practice:"+problem.id,hintStep===0?"correct":"assisted");
    }
    setPhase("committed");
    setVerdict(problem.answerKind === 'code'
      ? { text: '編集したコードは実行・採点していません。固定教材の実行結果と区別してください。', kind: 'info' }
      : { text: ok ? "あなたの推測が期待値と一致しました。" : "期待値とは違いました。どこが違うかを見てみましょう。", kind: ok ? "ok" : "bad" });
    setTimeout(() => commitRef.current?.focus(), 30);
  };

  const startRetry = () => {
    setPhase("retry");
    setRetryAnswer("");
    setHintStep(0);
    setVerdict(null);
  };

  const submitRetry = () => {
    if (problem.answerKind === 'code') {
      setVerdict({ text: '編集コードは未実行・未判定です。', kind: 'info' });
      return;
    }
    const ok = judgeLegacyAnswer(problem, retryAnswer);
    const next = applyAttempt(state, problem, {
      prediction: retryAnswer,
      actual: fallback?.lines.join("\n") ?? "",
      ok,
      blind: hintStep === 0,
    });
    onChange(next.state);
    if (ok) {
      questionCompleted("practice:"+problem.id,hintStep===0?"correct":"assisted");
      setVerdict({ text: hintStep === 0 ? "答えを隠したまま書けました。" : "ヒントを使って答えました。次は時間を空けて自力でも試しましょう。", kind: "ok" });
      if (problem.transfer) setPhase("transfer");
      else setPhase("done");
    } else {
      setVerdict({ text: "まだ違います。一行修正をもう一度見てから、別の言葉で書いてみましょう。", kind: "bad" });
      setHintStep((n) => Math.min(n + 1, problem.hints.length));
    }
  };

  const reveal = () => {
    const next = applyAttempt(state, problem, {
      prediction: retryAnswer,
      actual: fallback?.lines.join("\n") ?? "",
      ok: false,
      blind: false,
    });
    onChange(next.state);
    setVerdict({
      text: "答えを見て復習に回しました。この問題は後日、復習枠で再度問われます。",
      kind: "info",
    });
    setPhase("committed");
    setRetryAnswer("");
  };

  const submitTransfer = () => {
    if (!transferProblem) return;
    if (transferProblem.answerKind === 'code') {
      setVerdict({ text: '編集コードは未実行・未判定です。', kind: 'info' });
      return;
    }
    const ok = judgeLegacyAnswer(transferProblem, transferAnswer);
    const next = applyTransfer(state, transferProblem, ok, true);
    onChange(next.state);
    setVerdict({
      text: ok
        ? "同じ規則を別の形でも使いこなせました。"
        : "この形では規則が通用しませんでした。どこが違うかを言葉にしてみてください。",
      kind: ok ? "ok" : "bad",
    });
    if (!ok) setHintStep((n) => Math.min(n + 1, transferProblem.hints.length));
  };

  return (
    <div className="lp-">
      <main className="lp-main">
        <p className="lp-sub">
          <button type="button" onClick={leave}>
            ← 一覧へ戻る
          </button>
        </p>
        <h1>{problem.prompt}</h1>
        <div className="lp-meta">
          <span className="lp-chip">
            <strong>{problem.language === "java" ? "Java" : "Rust"}</strong>
          </span>
          <span className="lp-chip">
            トピック <strong>{TOPIC_MAP[problem.topic]?.name ?? problem.topic}</strong>
          </span>
          <span className="lp-chip">
            レベル <strong>{problem.level}</strong>
          </span>
          <span className="lp-chip">{QUESTION_LABEL[problem.questionType]}</span>
          <span className="lp-chip">
            実行 <strong>{executionLabel(problem.execution)}</strong>
          </span>
        </div>

        {record && record.attempts > 0 && (
          <p className="lp-rule">
            この問題は {record.attempts} 回解いています。正答 {record.correct} 回、誤答 {record.errorCount} 回。
          </p>
        )}

        {phase === "predict" && (
          <section className="lp-card" aria-labelledby="lp-q">
            <h2 id="lp-q">まず推測する</h2>
            <p className="lp-sub">
              コードを読んで、出るはずの結果（またはコンパイラの判定）を先に書いてください。答えは次に表示します。
            </p>
            {options.length > 0 && (
              <div className="lp-choices" role="group" aria-label="選択肢">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="lp-choice"
                    aria-pressed={picked === option}
                    disabled={running}
                    onClick={() => setPicked((p) => (p === option ? null : option))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            <label className="lp-rule" htmlFor="lp-free">
              {options.length > 0
                ? "選択肢でも可ですが、自分で書いておくと再現力がつきます。"
                : problem.prediction.text}
            </label>
            <textarea
              id="lp-free"
              className="lp-editor"
              value={prediction}
              disabled={running}
              placeholder={problem.answerKind === "code" ? "コードを書きます" : "出力は1行ずつ入力"}
              onChange={(e) => { setPicked(null); setPrediction(e.target.value); }}
            />
            <div className="lp-actions">
              <button ref={commitRef} className="primary" disabled={!canCommit} onClick={() => void commit()}>
                {running ? "実行中…" : "推測を確定して実行"}
              </button>
              {hintStep > 0 && <span className="lp-hint">ヒント：{hint}</span>}
              {hintStep < problem.hints.length && (
                <button type="button" disabled={running} onClick={() => setHintStep((n) => n + 1)}>
                  ヒントをみる
                </button>
              )}
            </div>
            {problem.code && (
              <>
                <h3>コード</h3>
                <CodeBlock
                  code={problem.code}
                  language={problem.language}
                  blanks={problem.code.includes("____")}
                />
              </>
            )}
          </section>
        )}

        {phase !== "predict" && phase !== "transfer" && (
          <>
            {verdict && <div className={`lp-verdict ${verdict.kind === "ok" ? "ok" : verdict.kind === "bad" ? "bad" : ""}`}>{verdict.text}</div>}

            {phase === "committed" && (
              <section className="lp-card" aria-labelledby="lp-actual" ref={panelRef("committed")} tabIndex={-1}>
                <h2 id="lp-actual">実行結果・検証記録</h2>
                <p className="lp-sub">出力元：{actualSource}</p>
                {runError && <p className="lp-note">{runError}</p>}
                <div className="lp-output">{actual ? actual.lines.join("\n") : "…"}</div>

                <h3>自分の推測との差</h3>
                <div className="lp-diff">
                  <div className="mine">
                    <h4>あなたの推測</h4>
                    <div className="lp-output">{(freeText ?? "").trim() || "（何も書かなかった）"}</div>
                  </div>
                  <div className="real">
                    <h4>実際</h4>
                    <div className="lp-output">{actual?.lines.join("\n") ?? "…"}</div>
                  </div>
                </div>

                <div className="lp-actions">
                  <button className="primary" onClick={() => setPhase("why")}>
                    なぜそうなる？
                  </button>
                  <button type="button" onClick={startRetry}>
                    答えを隠してもう一度
                  </button>
                </div>
              </section>
            )}

            {phase === "why" && (
              <section className="lp-card" aria-labelledby="lp-why" ref={panelRef("why")} tabIndex={-1}>
                <h2 id="lp-why">なぜそうなる？</h2>
                <p className="lp-why">{problem.explanation}</p>
                <p className="lp-rule">
                  <strong>多くの人がここを誤る：</strong>
                  {problem.misconception}
                  <span className="lp-chip" style={{ marginLeft: 8 }}>
                    {MISCONCEPTION_LABEL[problem.misconceptionClass]}
                  </span>
                </p>
                <div className="lp-actions">
                  <button className="primary" onClick={() => setPhase("patch")}>
                    一行でまとめる
                  </button>
                  <button type="button" onClick={startRetry}>
                    答えを隠してもう一度
                  </button>
                </div>
              </section>
            )}

            {phase === "patch" && (
              <section className="lp-card" aria-labelledby="lp-patch" ref={panelRef("patch")} tabIndex={-1}>
                <h2 id="lp-patch">一行修正</h2>
                <p className="lp-rule">
                  解説を読んだだけでは定着しません。この一文を自分で言えるようにします。
                </p>
                <div className="lp-patch">{problem.oneLinePatch}</div>
                {hintStep > 0 && <p className="lp-hint">ヒント：{hint}</p>}
                <div className="lp-actions">
                  <button className="primary" onClick={startRetry}>
                    隠して再現する
                  </button>
                  {hintStep < problem.hints.length && (
                    <button type="button" disabled={running} onClick={() => setHintStep((n) => n + 1)}>
                      ヒントをみる
                    </button>
                  )}
                </div>
              </section>
            )}

            {phase === "retry" && (
              <section className="lp-card" aria-labelledby="lp-retry" ref={panelRef("retry")} tabIndex={-1}>
                <h2 id="lp-retry">答えを隠して、書けるか</h2>
                <p className="lp-sub">
                  説明はもう見えません。コードを見て、先ほどと同じ答えを自力で書いてください。書けて初めて「学習した」になります。
                </p>
                {problem.code && <CodeBlock code={problem.code} language={problem.language} />}
                <label className="lp-rule" htmlFor="lp-retry-input">
                  答え
                </label>
                <textarea
                  id="lp-retry-input"
                  className="lp-editor"
                  value={retryAnswer}
                  onChange={(e) => setRetryAnswer(e.target.value)}
                />
                <div className="lp-actions">
                  <button className="primary" disabled={!retryAnswer.trim()} onClick={submitRetry}>
                    再現を提出
                  </button>
                  <button type="button" onClick={reveal}>
                    見せて、復習に回す
                  </button>
                </div>
                {hintStep > 0 && <p className="lp-hint">ヒント：{hint}</p>}
                <p className="lp-note">
                  「見せて、復習に回す」は正答として扱いません。後日、復習枠で再度問われます。
                </p>
              </section>
            )}

            {phase === "done" && (
              <section className="lp-card" ref={panelRef("done")} tabIndex={-1}>
                <h2>再現できました</h2>
                <p className="lp-rule">
                  この問題は「学習済み」として扱います。復習は {problem.reviewInterval} 日後に予約されました。
                </p>
                <div className="lp-actions">
                  <button className="primary" onClick={leave}>
                    一覧へ戻る
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {phase === "transfer" && transferProblem && (
          <section className="lp-card" aria-labelledby="lp-transfer" ref={panelRef("transfer")} tabIndex={-1}>
            <h2 id="lp-transfer">別の形で通用するか</h2>
            <p>{transferProblem.prompt}</p>
            <div className="lp-meta">
              <span className="lp-chip">
                <strong>{transferProblem.language === "java" ? "Java" : "Rust"}</strong>
              </span>
              <span className="lp-chip">
                トピック <strong>{TOPIC_MAP[transferProblem.topic]?.name ?? transferProblem.topic}</strong>
              </span>
            </div>
            {transferProblem.code && (
              <CodeBlock code={transferProblem.code} language={transferProblem.language} />
            )}
            <label className="lp-rule" htmlFor="lp-transfer-input">
              {transferProblem.prediction.text}
            </label>
            <textarea
              id="lp-transfer-input"
              className="lp-editor"
              value={transferAnswer}
              onChange={(e) => setTransferAnswer(e.target.value)}
            />
            <div className="lp-actions">
              <button className="primary" disabled={!transferAnswer.trim()} onClick={submitTransfer}>
                転移を提出
              </button>
              <button type="button" onClick={leave}>
                スキップ
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function executionLabel(execution: Problem["execution"]): string {
  switch (execution) {
    case "browser-java":
      return "ブラウザで Java 実行（TeaVM）";
    case "rust-verified":
      return "WASM / rustc で検証";
    case "jvm-verified":
      return "javac で検証";
    case "compile-checked":
      return "コンパイラで検証";
    case "teaching-runtime":
      return "指導用サブセット";
    default:
      return "読むだけ";
  }
}
