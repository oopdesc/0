/**
 * 学習ループ本体。
 *
 *  1 PROBLEM  問題を読む
 *  2 PREDICT  予測を書く（自由記述・選択・穴埋め・並べ替え・コード）
 *  3 COMMIT   予測を確定する（確定するまで結果は出さない）
 *  4 EXECUTE  実行する / 実測結果を見る
 *  5 DIFF     予測と実際を並べる
 *  6 WHY      誤解に名前を付ける
 *  7 PATCH    1 行ルール
 *  8 RETRY    同じ核心の別問題
 *  9 RETRIEVAL 時間を空けて思い出す
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '../content/types';
import { LEVEL_LABEL, KIND_LABEL } from '../content/types';
import { AnswerInput, isAnswered, type AnswerValue } from './AnswerInput';
import { CodeBlock } from './CodeBlock';
import { DiffView, isCorrect } from './DiffView';
import { gradeCodeAnswer } from '../lib/gradeCode';
import { javaSnippetCheck } from '../lib/codeCheck';
import { TracePlayer } from './TracePlayer';
import { runJava, type RunResult } from '../engine/java/interpreter';
import { conceptName, causeName, causeDrill, nextAfter, seededShuffle, transferOf } from '../lib/learn';
import { INTERVALS } from '../state/store';
import { saveRule, markRuleUsed, useStore } from '../state/useStore';
import type { State } from '../state/store';
import { Link } from '../lib/router';

export interface LoopResult {
  ok: boolean;
  ms: number;
  usedSolution: boolean;
  cause: string;
}

const STEP_NAMES = [
  '問題',
  '予測',
  '確定',
  '実行',
  '差分',
  '理由',
  '1 行',
  '再挑戦',
  '想起',
] as const;

export function Loop({
  problem,
  role,
  state,
  onFinish,
}: {
  problem: Problem;
  role: 'predict' | 'retry' | 'review';
  state: State;
  onFinish: (r: LoopResult) => void;
}) {
  const [value, setValue] = useState<AnswerValue | null>(null);
  const [committed, setCommitted] = useState(false);
  const [hints, setHints] = useState(0);
  const [solutionSeen, setSolutionSeen] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const started = useRef(Date.now());
  const finished = useRef(false);
  const commitRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 問題が変わったら状態を戻す
  useEffect(() => {
    setValue(null);
    setCommitted(false);
    setHints(0);
    setSolutionSeen(false);
    setRun(null);
    setRunError(null);
    setShowTrace(false);
    started.current = Date.now();
    finished.current = false;
  }, [problem.id]);

  const correct = useMemo(() => (committed ? isCorrect(problem, value) : false), [committed, problem, value]);

  // 復習では選択肢の順を毎回変える（同じ並びを覚えてしまわないように）
  const shuffled = useMemo(() => {
    if (problem.answer.mode !== 'choice' || role === 'predict') return undefined;
    const seed = `${problem.id}:${state.attempts.filter((a) => a.pid === problem.id).length}`;
    return seededShuffle(problem.answer.options.map((_, i) => i), seed);
  }, [problem, role, state.attempts]);

  const canCommit = isAnswered(problem.answer, value);

  // 画面に出している案内（「Enter でも確定できます」「1 〜 4 キーで選べます」）と
  // 実際のキーボード操作を一致させる。案内だけ出して動かない状態にしない。
  const commitFn = useRef<() => void>(() => {});
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'INPUT' || el?.isContentEditable) return;
      if (committed) return;
      if (problem.answer.mode === 'choice' && /^[1-9]$/.test(e.key)) {
        const order = shuffled ?? problem.answer.options.map((_, i) => i);
        const idx = order[Number(e.key) - 1];
        if (idx !== undefined) {
          setValue({ kind: 'choice', index: idx });
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Enter' && canCommit) {
        commitFn.current();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [committed, canCommit, problem, shuffled]);

  function commit() {
    if (!canCommit || committed) return;
    setCommitted(true);
    const ms = Date.now() - started.current;
    if (!finished.current) {
      finished.current = true;
      onFinish({ ok: isCorrect(problem, value) && !solutionSeen, ms, usedSolution: solutionSeen, cause: primaryCause(problem, value) });
    }
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  commitFn.current = commit;

  function execute() {
    const source = problem.verifyCode ?? problem.code;
    if (!source) return;
    try {
      const res = runJava(source, { mode: problem.harness ?? 'body', trace: true, maxSteps: 4000 });
      setRun(res);
      setRunError(null);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  // 実行できるのは、端末のエンジンで結果を再現できると検証済みの問題だけ。
  // それ以外は JDK / rustc の実測記録を表示する（実行したように見せない）。
  const canRunLive = problem.lang === 'java' && problem.interactive === true && Boolean(problem.verifyCode ?? problem.code);
  const stepNow = !committed ? (canCommit ? 3 : 2) : showTrace || run ? 4 : 5;

  return (
    <article className="loop" aria-labelledby="loop-title">
      <ol className="stepper" aria-label="学習の手順">
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const state_ = n < stepNow ? 'done' : n === stepNow ? 'now' : 'todo';
          return (
            <li key={name} className={`stepper__item is-${state_}`}>
              <span className="stepper__n">{n}</span>
              <span className="stepper__name">{name}</span>
            </li>
          );
        })}
      </ol>

      {/* STEP 1 */}
      <header className="loop__head">
        <div className="loop__meta">
          <span className={`chip chip--${problem.lang}`}>{problem.lang === 'java' ? 'Java 21' : 'Rust 1.99'}</span>
          <span className="chip">{LEVEL_LABEL[problem.level]}</span>
          <span className="chip">{KIND_LABEL[problem.kind]}</span>
          {role !== 'predict' && <span className="chip chip--role">{role === 'retry' ? '再挑戦' : '想起'}</span>}
        </div>
        <h2 id="loop-title" className="loop__title">
          {problem.title}
        </h2>
        <p className="loop__prompt">{problem.prompt}</p>
        <div className="loop__concepts">
          {problem.concepts.map((c) => (
            <Link key={c} to={`/learn/${problem.lang}/${c}`} className="tag">
              {conceptName(c)}
            </Link>
          ))}
        </div>
      </header>

      {problem.code && (
        <CodeBlock
          code={problem.code}
          lang={problem.lang}
          label={problem.harness === 'unit' ? 'コード（そのまま）' : 'コード（class と main の中身として実行）'}
        />
      )}
      {problem.codeNote && <p className="note">{problem.codeNote}</p>}

      {/* STEP 2 */}
      <section className="step" aria-labelledby="s2">
        <h3 className="step__title" id="s2">
          <span className="step__n">2</span> 先に予測する
        </h3>
        <p className="step__lead">
          {role === 'review'
            ? '前回の記憶だけを頼りに答える。説明は確定するまで開かない。'
            : '実行する前に、何が起きるかを決める。間違えてよい。予測した事実が学習を進める。'}
        </p>

        <SavedRulesHint problem={problem} />

        <AnswerInput
          answer={problem.answer}
          value={value}
          onChange={setValue}
          disabled={committed}
          lang={problem.lang}
          shuffled={shuffled}
          codeCheck={problem.lang === 'java' && problem.answer.mode === 'code' ? javaSnippetCheck : undefined}
          onCommit={canCommit ? commit : undefined}
        />

        {!committed && (
          <div className="step__actions">
            <button
              ref={commitRef}
              type="button"
              className="btn btn--primary"
              onClick={commit}
              disabled={!canCommit}
              aria-disabled={!canCommit}
              title={canCommit ? '予測を確定して結果を見る' : '先に予測を入力してください'}
            >
              予測を確定する
            </button>
            <span className="step__hint-inline">
              {canCommit ? 'Enter でも確定できます' : '予測を入力すると押せます'}
              {problem.answer.mode === 'choice' && !committed && (
                <span className="step__hint-keys">
                  {' '}
                  / 1〜{Math.min(problem.answer.options.length, 9)} キーでも選べます
                </span>
              )}
            </span>
          </div>
        )}

        {!committed && (
          <div className="hints">
            <h4 className="hints__title">ヒント（段階的に開く）</h4>
            <ol className="hints__list">
              {(problem.hints ?? []).map((h, i) => (
                <li key={i} className={`hints__item ${i < hints ? 'is-open' : ''}`}>
                  {i < hints ? (
                    <p>{h}</p>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--tiny"
                      onClick={() => {
                        if (i === 0 && hints === 0) setHints(1);
                        else setHints(i + 1);
                        if (i === 2) setSolutionSeen(true);
                      }}
                      disabled={i > hints}
                    >
                      ヒント {i + 1} を見る{i === 2 ? '（答えに近い）' : ''}
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {solutionSeen && (
              <p className="hints__warn">
                ヒント 3 まで見たので、この回は「定着」には数えません。次の類題で再現できれば定着です。
              </p>
            )}
          </div>
        )}
      </section>

      {/* STEP 3 はボタンそのもの（予測なしには確定できない） */}

      {committed && problem.answer.mode === 'code' && value?.kind === 'code' && (
        <CodeVerdict problem={problem} code={value.text} />
      )}

      {committed && (
        <div ref={resultRef} className="result" aria-live="polite" aria-atomic="false">
          {/* STEP 4 */}
          <section className="step" aria-labelledby="s4">
            <h3 className="step__title" id="s4">
              <span className="step__n">4</span> 実行して確かめる
            </h3>
            {problem.lang === 'java' && canRunLive ? (
              <>
                <div className="step__actions">
                  <button type="button" className="btn" onClick={execute}>
                    このコードを実行する
                  </button>
                  {run && (
                    <button type="button" className="btn btn--ghost" onClick={() => setShowTrace((x) => !x)}>
                      {showTrace ? '1 行ずつの表示を閉じる' : '1 行ずつ追う'}
                    </button>
                  )}
                  <span className="badge badge--verified">ブラウザ内エンジン</span>
                </div>
                {run && (
                  <div className="runout">
                    <div className="runout__head" role="status">
                      <span className={run.ok ? 'dot dot--ok' : 'dot dot--bad'} />
                      {run.ok ? '正常終了' : run.error ? `${run.error.type}: ${run.error.message}` : 'エラー'}
                      <span className="runout__time">{run.elapsedMs.toFixed(1)} ms</span>
                    </div>
                    <pre className="runout__out">{run.output.length ? run.output.join('\n') : '（出力なし）'}</pre>
                    {(run.error || run.compileError) && (
                      <p className="runout__err">{run.error ? `${run.error.type}: ${run.error.message}` : run.compileError?.message}</p>
                    )}
                  </div>
                )}
                {showTrace && run && <TracePlayer code={problem.verifyCode ?? problem.code ?? ''} result={run} />}
                {runError && <p className="note note--bad">実行できませんでした: {runError}</p>}
              </>
            ) : (
              <div className="measured">
                <p className="measured__lead">
                  {problem.lang === 'rust'
                    ? 'Rust はブラウザでコンパイルできないため、この問題のコードは実際の rustc検証記録した結果を表示します。'
                    : 'この問題は実行を伴わないため、検証済みの結果を表示します。'}
                </p>
                {problem.verified && (
                  <dl className="measured__facts">
                    <div>
                      <dt>ツール</dt>
                      <dd>{problem.verified.version}</dd>
                    </div>
                    <div>
                      <dt>判定</dt>
                      <dd>{verdictLabel(problem.verified.verdict)}</dd>
                    </div>
                    {problem.verified.errorCode && (
                      <div>
                        <dt>コード</dt>
                        <dd className="mono">{problem.verified.errorCode}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {problem.verified && problem.verified.stderr.length > 0 && (
                  <details className="rawout">
                    <summary>
                      実際のツール出力を開く（{problem.verified.tool}、{problem.verified.stderr.length} 行）
                    </summary>
                    <pre className="rawout__body">{problem.verified.stderr.join('\n')}</pre>
                  </details>
                )}
              </div>
            )}
          </section>

          {/* STEP 5 */}
          <section className="step" aria-labelledby="s5">
            <h3 className="step__title" id="s5">
              <span className="step__n">5</span> 予測と実際の差分
            </h3>
            <DiffView p={problem} value={value} correct={correct} />
          </section>

          {/* STEP 6 */}
          <section className="step" aria-labelledby="s6">
            <h3 className="step__title" id="s6">
              <span className="step__n">6</span> つまずきに名前を付ける
            </h3>
            <div className="why">
              <div className="why__row">
                <span className="why__label">よくある思い込み</span>
                <p>{problem.misconception.belief}</p>
              </div>
              <div className="why__row">
                <span className="why__label">そう思う理由</span>
                <p>{problem.misconception.whyTempting}</p>
              </div>
              <div className="why__row why__row--fix">
                <span className="why__label">実際に起きること</span>
                <p>{problem.misconception.correction}</p>
              </div>
              <p className="why__cause">
                原因の分類: <strong>{causeName(problem.misconception.cause)}</strong>
                {causeDrill(problem.misconception.cause) && <span> — {causeDrill(problem.misconception.cause)}</span>}
              </p>
            </div>
            <ExplainBeforeReveal problem={problem} />
          </section>

          {/* STEP 7 */}
          <section className="step" aria-labelledby="s7">
            <h3 className="step__title" id="s7">
              <span className="step__n">7</span> 持ち帰る 1 行
            </h3>
            <div className="patch">
              <p className="patch__text">{problem.patch}</p>
              <CopyPatch text={problem.patch} />
              <SaveRule problem={problem} />
            </div>
          </section>

          {/* STEP 8 */}
          <section className="step" aria-labelledby="s8">
            <h3 className="step__title" id="s8">
              <span className="step__n">8</span> すぐに別の形でもう一問
            </h3>
            <RetryBlock problem={problem} state={state} />
          </section>

          {/* STEP 9 */}
          <section className="step" aria-labelledby="s9">
            <h3 className="step__title" id="s9">
              <span className="step__n">9</span> 時間を空けて思い出す
            </h3>
            <RetrievalBlock problem={problem} correct={correct} usedSolution={solutionSeen} />
          </section>
        </div>
      )}
    </article>
  );
}

function verdictLabel(v: 'ok' | 'compile-error' | 'runtime-error' | 'error'): string {
  if (v === 'ok') return 'コンパイル成功・実行成功';
  if (v === 'compile-error') return 'コンパイルエラー';
  if (v === 'runtime-error') return '実行時エラー';
  return '検証エラー';
}

function primaryCause(p: Problem, v: AnswerValue | null): string {
  if (p.answer.mode === 'choice' && v?.kind === 'choice') {
    const opt = p.answer.options[v.index];
    if (opt?.cause) return opt.cause;
  }
  return p.misconception.cause;
}

function RetryBlock({ problem, state }: { problem: Problem; state: State }) {
  const next = nextAfter(problem, state);
  const t = transferOf(problem);
  if (!next.problem) return <p className="note">この分野の類題はここまでです。</p>;
  return (
    <div className="retry">
      <p className="retry__reason">{next.reason}</p>
      <Link to={`/p/${next.problem.id}?r=retry`} className="btn btn--primary">
        類題を解く（{next.problem.title}）
      </Link>
      {t && t.id !== next.problem.id && (
        <Link to={`/p/${t.id}?r=retry`} className="btn btn--ghost">
          もう 1 つ（{t.title}）
        </Link>
      )}
    </div>
  );
}

function RetrievalBlock({ problem, correct, usedSolution }: { problem: Problem; correct: boolean; usedSolution: boolean }) {
  const variants = (problem.reviewVariants ?? []).filter((id) => id !== problem.id);
  const intervals = INTERVALS.join(' / ');
  return (
    <div className="retrieval">
      <p>
        この問題は <strong>1 / 3 / 7 / 14 / 30 日</strong> の間隔で戻ってきます（{intervals} 日）。
        正解でも間隔は伸び、間違えると 1 日に戻ります。
      </p>
      {!correct && <p className="note">間違えた問題は ERROR LAB に残り、同じ原因の問題が優先して出ます。</p>}
      {usedSolution && <p className="note">ヒント 3 を見た回は、次回の「隠された状態」での正解で定着とします。</p>}
      {variants.length > 0 && (
        <p className="note">
          次回は別の見た目で出ます:{' '}
          {variants.map((id, i) => (
            <span key={id}>
              {i > 0 && '、'}
              <Link to={`/p/${id}?r=review`} className="link">
                {id}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * コード問題の採点結果。
 * 実行して採点できた場合はテストごとの期待値と実際の出力を並べる。
 * 実行できない場合（Rust など）は「簡易チェック」と明記し、できたことにしない。
 */
function CodeVerdict({ problem, code }: { problem: Problem; code: string }) {
  const grade = gradeCodeAnswer(problem, code);
  return (
    <section className="step" aria-labelledby="grade">
      <h3 className="step__title" id="grade">
        <span className="step__n">4</span> あなたのコードの採点
      </h3>
      {grade.ran ? (
        <>
          <p className="note">
            {grade.ok ? 'すべてのテストに通りました。' : '通らないテストがあります。期待値と実際の出力を見比べてください。'}
            <span className="badge">ブラウザ内エンジンで実行</span>
          </p>
          <ul className="gradelist">
            {grade.tests.map((t, i) => (
              <li key={i} className={t.ok ? 'gradelist__row is-ok' : 'gradelist__row is-bad'}>
                <span className="gradelist__mark" aria-hidden="true">{t.ok ? '✓' : '×'}</span>
                <code className="gradelist__in">{t.input || '(引数なし)'}</code>
                <span className="gradelist__exp">期待 {t.expected.join(' / ')}</span>
                <span className="gradelist__got">実際 {t.error ?? (t.got.length ? t.got.join(' / ') : '(出力なし)')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="note">
          この問題は実行して採点していません（{problem.lang === 'rust' ? 'ブラウザでは Rust をコンパイルしないため' : 'テストが無いため'}）。
          {grade.notes.map((n) => (
            <span key={n}> {n}</span>
          ))}
        </p>
      )}
    </section>
  );
}

/** 1 行ルールのコピー。押した結果を必ず返す（無言のボタンにしない）。 */
function CopyPatch({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--tiny"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState('done');
        } catch {
          setState('failed');
        }
      }}
    >
      {state === 'done' ? 'コピーしました' : state === 'failed' ? 'コピーできません（選択して手動で）' : 'コピー'}
    </button>
  );
}

/**
 * Explain Before Reveal。
 * 説明を「読む」前に、自分の言葉で 1 度書かせる。採点はしない（AI も使わない）。
 * 書いた内容はその場で説明と並べるだけで、正誤は判定しない。
 * 「わからない」を選んだ場合は、書かずに説明へ進める（詰まらせない）。
 */
function ExplainBeforeReveal({ problem }: { problem: Problem }) {
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const canReveal = text.trim().length >= 8;

  if (revealed) {
    return (
      <div className="explainblock">
        {!skipped && (
          <div className="explainblock__mine">
            <h4 className="explainblock__h">あなたの説明</h4>
            <p>{text.trim()}</p>
            <p className="note">
              自動採点はしていません。下の説明と読み比べて、ずれている部分に線を引くつもりで読んでください。
            </p>
          </div>
        )}
        <div className="explainblock__model">
          <h4 className="explainblock__h">{skipped ? '説明' : '模範の説明'}</h4>
          <p className="explain">{problem.explanation}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="explainblock explainblock--gate">
      <h4 className="explainblock__h">先に、自分の言葉で説明する</h4>
      <p className="note">
        「なぜそうなるか」を 1〜2 文で書いてから説明を開きます。採点はしません（自動判定も AI も使いません）。
        書くことで、読んだだけの理解と自分の理解の差が見えます。
      </p>
      <textarea
        className="explainblock__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="自分の言葉での説明"
        placeholder="例: int 同士の割り算は int になるので、小数が切り捨てられる"
      />
      <div className="step__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canReveal}
          aria-disabled={!canReveal}
          onClick={() => setRevealed(true)}
          title={canReveal ? '説明を開く' : '8 文字以上で書くと開けます'}
        >
          説明を開く
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setSkipped(true);
            setRevealed(true);
          }}
        >
          わからないので説明を見る
        </button>
        <span className="step__hint-inline">
          {canReveal ? `${text.trim().length} 文字` : '8 文字以上で開けます'}
        </span>
      </div>
    </div>
  );
}

/** 1 行ルールを 自分のルール に保存する（同じ文言は重複しない）。 */
function SaveRule({ problem }: { problem: Problem }) {
  const state = useStore();
  const saved = state.rules.find((r) => r.text === problem.patch);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--tiny"
      onClick={() => saveRule({ pid: problem.id, text: problem.patch, concept: problem.concepts[0] })}
      aria-pressed={Boolean(saved)}
    >
      {saved ? '自分のルール に保存済み' : '自分のルール に保存'}
    </button>
  );
}

/**
 * 前回の自分用 1 行（自分のルール）を、答える前に思い出すための小さな入口。
 * 開いて「思い出した」を押すと使用回数が増える（読むだけでは記録しない）。
 */
function SavedRulesHint({ problem }: { problem: Problem }) {
  const state = useStore();
  const mine = state.rules.filter((r) => problem.concepts.includes(r.concept ?? '') || r.text === problem.patch).slice(0, 3);
  const [open, setOpen] = useState(false);
  if (mine.length === 0) return null;
  return (
    <div className="savedrules">
      <button type="button" className="btn btn--ghost btn--tiny" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '自分のルールを閉じる' : `前回の自分のルールを見る（${mine.length}）`}
      </button>
      {open && (
        <ul className="savedrules__list">
          {mine.map((r) => (
            <li key={r.id} className="savedrules__item">
              <p>{r.text}</p>
              <button type="button" className="btn btn--ghost btn--tiny" onClick={() => markRuleUsed(r.id)}>
                思い出した（使った）
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
