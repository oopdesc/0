import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Play,
  Sparkles,
} from "lucide-react";
import { getLesson, STAGES } from "../domain/lessons";
import {
  getScaffold,
  shuffledBlocks,
  stagePrompt,
  stageSource,
} from "../domain/scaffolds";
import {
  isRebuildSatisfied,
  predictionMatches,
  runLesson,
} from "../domain/runner";
import type { LessonId, ModelState, RunResult, Stage } from "../domain/types";
import type { LessonProgress } from "../domain/progress";
import { CodeEditor } from "./CodeEditor";
import { OrbitScene, type Quality } from "./OrbitScene";

interface Props {
  lessonId: LessonId;
  initialStage: Stage;
  progress: LessonProgress;
  model: ModelState;
  playing: boolean;
  onToggle: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  modelOrigin: string;
  onRun: (
    correct: boolean,
    result: RunResult,
    stage: Stage,
    recallSatisfied: boolean,
  ) => void;
}
function patchCode(id: LessonId, code: string): string {
  if (id === "java-array")
    return code.replace(/(i\s*)<=\s*(orbits\s*\.\s*length)/, "$1< $2");
  if (id === "java-stream")
    return code.replace(/(radius\s*)>(?![=])\s*(\d+)/, "$1>= $2");
  if (id === "java-polymorphism")
    return code.replace(/new\s+Star\s*\(\s*\)/, "new Planet()");
  if (id === "rust-result")
    return code.replace(
      /(let\s+radius\s*=\s*)-?\d+/,
      (_match, prefix: string) => `${prefix}3`,
    );
  if (id === "rust-ownership")
    return code.replace(/(let\s+view\s*=\s*)stars\s*;/, "$1&stars;");
  return code.replace(
    /(let\s+index\s*:\s*usize\s*=\s*)\d+/,
    (_match, prefix: string) => `${prefix}0`,
  );
}
export function Lab(props: Props) {
  const lesson = getLesson(props.lessonId);
  const [stage, setStage] = useState<Stage>(props.initialStage);
  const [code, setCode] = useState(stageSource(lesson, props.initialStage));
  const [prediction, setPrediction] = useState("");
  const [submittedPrediction, setSubmittedPrediction] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [matches, setMatches] = useState(false);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [fillChoice, setFillChoice] = useState("");
  const [blocks, setBlocks] = useState(() => shuffledBlocks(lesson));
  const [blockNotice, setBlockNotice] = useState("");
  const supportLabel = ["詳しい手がかり", "標準の手がかり", "最小の手がかり"][
    props.progress.support
  ];
  const updateCode = (next: string) => {
    setCode(next);
    setResult(null);
    setPrediction("");
    setStep(0);
    setNotice("コードを変更しました。もう一度予測してください。");
  };
  const changeStage = (next: Stage) => {
    setStage(next);
    setCode(stageSource(lesson, next));
    setFillChoice("");
    setBlocks(shuffledBlocks(lesson));
    setBlockNotice("");
    setPrediction("");
    setSubmittedPrediction("");
    setResult(null);
    setStep(0);
    setNotice("");
  };
  const run = (event: FormEvent) => {
    event.preventDefault();
    if (!prediction.trim()) {
      setNotice("実行する前に、結果を予測して入力してください。");
      return;
    }
    const next = runLesson(lesson.id, code);
    const matched = predictionMatches(prediction, next);
    setSubmittedPrediction(prediction);
    setResult(next);
    setMatches(matched);
    setStep(0);
    setNotice("");
    if (next.status !== "unsupported")
      props.onRun(matched, next, stage, isRebuildSatisfied(lesson.id, next));
  };
  const fixed = patchCode(lesson.id, code);
  const recallSatisfied = result
    ? isRebuildSatisfied(lesson.id, result)
    : false;
  return (
    <section
      className="lab-section shell section-space"
      id="lab"
      aria-labelledby="lab-title"
    >
      <div className="lab-header">
        <div>
          <p className="eyebrow">
            <span className="accent">02</span> / コードと模型
          </p>
          <h2 id="lab-title">
            考えたことを、
            <br className="mobile-only" />
            宇宙で確かめる。
          </h2>
        </div>
        <div className="lab-header-side">
          <span className="small-cross">✳</span>
          <p>
            予測に正解することだけが目的じゃない。
            <br />
            違いの中に、次の理解がある。
          </p>
        </div>
      </div>
      <div className="lab-panel">
        <div className="lab-titlebar">
          <div>
            <span className="lab-id">
              実験 {lesson.number} <i>/</i> {lesson.language.toUpperCase()}
            </span>
            <h3>{lesson.title}</h3>
            <p>{lesson.goal}</p>
          </div>
          <span className="lab-tag">{lesson.tag}</span>
        </div>
        <div className="stage-tabs" aria-label="学習段階">
          {STAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={stage === item.id ? "active" : ""}
              aria-pressed={stage === item.id}
              onClick={() => changeStage(item.id)}
            >
              <span>{item.number}</span> {item.label}
            </button>
          ))}
        </div>
        <div className="stage-description">
          <div>
            <span className="stage-indicator">
              {STAGES.find((s) => s.id === stage)?.number} /{" "}
              {STAGES.find((s) => s.id === stage)?.label}
            </span>
            <p>{stagePrompt(lesson, stage)}</p>
          </div>
          <span className="support-level">
            <Sparkles size={13} /> {supportLabel}
          </span>
        </div>
        {stage === "fill" && (
          <div className="scaffold-exercise">
            <div>
              <span className="eyebrow">穴を埋めて、処理をつなぐ</span>
              <p>空欄に入れるものを選び、コードに反映してください。</p>
            </div>
            <div className="scaffold-actions">
              <label>
                空欄{" "}
                <select
                  aria-label="穴埋めの選択肢"
                  value={fillChoice}
                  onChange={(e) => setFillChoice(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {getScaffold(lesson).choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-outline"
                disabled={!fillChoice || !code.includes("___")}
                onClick={() => updateCode(code.replace("___", fillChoice))}
              >
                空欄に反映 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
        {stage === "reorder" && (
          <div className="scaffold-exercise reorder-exercise">
            <div>
              <span className="eyebrow">SCAFFOLD / PUT IN ORDER</span>
              <p>依存関係に注意して並べ、コードに反映してください。</p>
            </div>
            <ol>
              {blocks.map((block, index) => (
                <li key={block}>
                  <span className="block-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <code>{block}</code>
                  <div>
                    <button
                      type="button"
                      aria-label={`ブロック${index + 1}を上に移動`}
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...blocks];
                        [next[index - 1], next[index]] = [
                          next[index],
                          next[index - 1],
                        ];
                        setBlocks(next);
                        setBlockNotice(`ブロックを${index}番へ移動しました。`);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`ブロック${index + 1}を下に移動`}
                      disabled={index === blocks.length - 1}
                      onClick={() => {
                        const next = [...blocks];
                        [next[index], next[index + 1]] = [
                          next[index + 1],
                          next[index],
                        ];
                        setBlocks(next);
                        setBlockNotice(
                          `ブロックを${index + 2}番へ移動しました。`,
                        );
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="scaffold-actions">
              <span aria-live="polite">{blockNotice}</span>
              <button
                type="button"
                className="button button-outline"
                onClick={() => updateCode(blocks.join("\n"))}
              >
                並びをコードに反映 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="lab-grid">
          <div className="code-column">
            <div className="column-title">
              <span>
                <span className="accent">A</span> / コード
              </span>
              <span>編集して試す</span>
            </div>
            <CodeEditor
              language={lesson.language}
              value={code}
              onChange={updateCode}
              onReset={() => updateCode(stageSource(lesson, stage))}
            />
            <p className="edit-guide">
              <CircleHelp size={14} /> <span>{lesson.editGuide}</span>
            </p>
            <details
              className="concept-details"
              open={props.progress.support === 0 ? true : undefined}
            >
              <summary>
                概念の構造と境界を読む <span>＋</span>
              </summary>
              <div className="concept-flow">
                <div>
                  <small>入力</small>
                  <b>{lesson.structure.input}</b>
                </div>
                <ArrowRight size={14} />
                <div>
                  <small>判断</small>
                  <b>{lesson.structure.decision}</b>
                </div>
                <ArrowRight size={14} />
                <div>
                  <small>処理</small>
                  <b>{lesson.structure.process}</b>
                </div>
                <ArrowRight size={14} />
                <div>
                  <small>結果</small>
                  <b>{lesson.structure.output}</b>
                </div>
              </div>
              <dl>
                <div>
                  <dt>役割</dt>
                  <dd>{lesson.structure.role}</dd>
                </div>
                <div>
                  <dt>不変条件</dt>
                  <dd>{lesson.structure.invariant}</dd>
                </div>
                <div>
                  <dt>境界</dt>
                  <dd>{lesson.structure.boundary}</dd>
                </div>
              </dl>
            </details>
          </div>
          <div className="experiment-column">
            <div className="column-title">
              <span>
                <span className="accent">B</span> / 模型の変化
              </span>
              <span>結果から模型へ</span>
            </div>
            <OrbitScene
              model={props.model}
              playing={props.playing}
              onToggle={props.onToggle}
              speed={props.speed}
              quality={props.quality}
              compact
            />
            <div className="simulation-settings">
              <span>
                {props.modelOrigin} · 軌道値:{" "}
                {props.model.radii.length
                  ? props.model.radii.join(" / ")
                  : "なし"}
                {props.model.highlightedIndex !== null
                  ? `（${props.model.highlightedIndex + 1}番目を選択）`
                  : ""}
              </span>
              <div>
                <label>
                  速度{" "}
                  <select
                    aria-label="シミュレーション速度"
                    value={props.speed}
                    onChange={(e) => props.setSpeed(Number(e.target.value))}
                  >
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                  </select>
                </label>
                <label>
                  品質{" "}
                  <select
                    aria-label="描画品質"
                    value={props.quality}
                    onChange={(e) =>
                      props.setQuality(e.target.value as Quality)
                    }
                  >
                    <option value="auto">自動</option>
                    <option value="high">高画質</option>
                    <option value="balanced">標準</option>
                    <option value="battery">省電力</option>
                  </select>
                </label>
              </div>
            </div>
            <form className="predict-form" onSubmit={run}>
              <div className="predict-heading">
                <span className="eyebrow">
                  <span className="accent">C</span> / 自分の予測
                </span>
                <span>実行結果</span>
              </div>
              <label htmlFor="prediction">実行すると、何が起きる？</label>
              <p>
                出力値、または「エラー」。複数行はカンマで区切る（例：3, 3）。
              </p>
              <div className="prediction-row">
                <input
                  id="prediction"
                  value={prediction}
                  onChange={(e) => setPrediction(e.target.value)}
                  autoComplete="off"
                  maxLength={80}
                  placeholder="ここに予測を入力"
                />
                <button className="button button-primary" type="submit">
                  <Play size={14} fill="currentColor" /> 実行する
                </button>
              </div>
              <p className="form-notice" aria-live="polite">
                {notice}
              </p>
            </form>
          </div>
        </div>
        {result && (
          <div className="run-feedback" aria-live="polite">
            {result.status === "unsupported" ? (
              <div className="feedback-unsupported">
                <span className="eyebrow">実行していません</span>
                <h4>教材の対応範囲を確認してください。</h4>
                <p>{result.explanation}</p>
                <p>{lesson.editGuide}</p>
              </div>
            ) : (
              <>
                <div className="feedback-heading">
                  <div>
                    <span className="eyebrow">
                      {matches ? "予測を確かめる" : "予測と結果の差"}
                    </span>
                    <h4>
                      {matches
                        ? result.status === "success"
                          ? "予測と結果が一致しました。"
                          : "予測は一致。コードにはエラーがあります。"
                        : "違いを、次の理解へ。"}
                    </h4>
                  </div>
                  <span
                    className={`feedback-badge ${matches ? "success" : ""}`}
                  >
                    {matches ? "一致" : "比較"}
                  </span>
                </div>
                <div className="compare-row">
                  <div>
                    <small>自分の予測</small>
                    <strong>{submittedPrediction}</strong>
                  </div>
                  <span className="compare-arrow">
                    <ArrowRight size={18} />
                  </span>
                  <div>
                    <small>実際の結果</small>
                    <strong className="actual-output">{result.actual}</strong>
                  </div>
                </div>
                <div className="error-insight">
                  <div>
                    <small>なぜ、そうなる？</small>
                    <p>
                      {result.explanation} {!matches && lesson.explanation}
                    </p>
                  </div>
                  <div className="one-line-patch">
                    <small>覚えておきたい1行</small>
                    <p>{result.patch}</p>
                    {fixed !== code && (
                      <button type="button" onClick={() => updateCode(fixed)}>
                        コードの1行を修正する <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {stage === "recall" && (
                  <p className="recall-status">
                    {recallSatisfied && matches
                      ? "再現の条件を満たしました。自力で書けたかも振り返ってください。"
                      : "再現課題は、出力だけでなく指定された入力・条件も満たす必要があります。"}
                  </p>
                )}
                <div className="trace">
                  <div className="trace-heading">
                    <div>
                      <span className="eyebrow">実行の流れ</span>
                      <h5>処理を、一歩ずつ。</h5>
                    </div>
                    <div className="trace-controls">
                      <button
                        type="button"
                        aria-label="前のステップ"
                        disabled={step === 0}
                        onClick={() => setStep(step - 1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span>
                        {step + 1} / {result.trace.length}
                      </span>
                      <button
                        type="button"
                        aria-label="次のステップ"
                        disabled={step >= result.trace.length - 1}
                        onClick={() => setStep(step + 1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="trace-state">
                    <span>{String(step + 1).padStart(2, "0")}</span>
                    <strong>{result.trace[step]?.label}</strong>
                    <code>{result.trace[step]?.state}</code>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <div className="truth-note">
          <span>実行の仕組み</span>
          <p>
            ブラウザでは教材専用の限定実行器が動きます。JVMやRustコンパイラそのものではありません。対応外のコードは実行せずお知らせします。エラー時のモデルは直前の成功結果を保持します。Javaはmain内部の抜粋です。Eclipseで試すときは、クラスとmainメソッドを用意し、Streamなどのimportも補ってください。
          </p>
        </div>
      </div>
    </section>
  );
}
