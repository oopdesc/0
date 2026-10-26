import { useReducer, useState, useSyncExternalStore } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { ErrorLabPanel } from '../components/ErrorLabPanel';
import { ConceptPanel } from '../components/ConceptPanel';
import { store } from '../../core/appStore';
import { universe } from '../../core/simulation/controller';
import {
  ALL_LESSONS, TRACK_LABEL, KIND_LABEL, getLesson, skipToLevel, shuffleLines,
  isCorrectAnswer, supportLevel, type Challenge, type Lesson, type Track,
} from '../../core/lessons';
import { initialLoopState, loopReducer, PHASE_LABEL, type RunSummary } from '../../core/learning/loop';
import type { ExecuteOutcome } from '../../core/lang';

export function LearnView() {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const lesson = getLesson(app.lessonId) ?? ALL_LESSONS[0]!;
  const index = Math.min(app.challengeIndex, lesson.challenges.length - 1);
  const challenge = lesson.challenges[index]!;
  const completed = app.progress.completed;

  const tracks: Track[] = ['java', 'rust', 'bridge'];

  return (
    <div className="learn">
      <aside className="learn__side" aria-label="レッスン一覧">
        <h2 className="section-label">LEARNING PATH</h2>
        {tracks.map((track) => (
          <section key={track} className="learn__group">
            <h3>{TRACK_LABEL[track]}</h3>
            <ul>
              {ALL_LESSONS.filter((l) => l.track === track).map((l) => {
                const done = l.challenges.filter((c) => completed[c.id]).length;
                return (
                  <li key={l.id}>
                    <button type="button" className={l.id === lesson.id ? 'is-active' : ''}
                      onClick={() => store.gotoLesson(l.id, 0)} aria-current={l.id === lesson.id ? 'page' : undefined}>
                      <span className="learn__kicker">{l.kicker}</span>
                      <span className="learn__title">{l.title}</span>
                      <span className="learn__progress">{done}/{l.challenges.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </aside>

      <div className="learn__main">
        <header className="learn__head">
          <p className="view-head__kicker">{lesson.kicker} · {lesson.minutes}分 · {lesson.challenges.length}課題</p>
          <h1>{lesson.title}</h1>
          <p className="learn__summary">{lesson.summary}</p>
          <div className="learn__head-actions">
            <button type="button" onClick={() => store.setChallengeIndex(skipToLevel(lesson, 7))}>
              理解済みなので自力生成へ飛ばす →
            </button>
            <button type="button" onClick={() => store.toggleFavorite(lesson.id)}
              aria-pressed={app.progress.favorites.includes(lesson.id)}>
              {app.progress.favorites.includes(lesson.id) ? '★ お気に入り' : '☆ お気に入り'}
            </button>
          </div>
        </header>

        <nav className="learn__steps" aria-label="課題の段階">
          <ol>
            {lesson.challenges.map((c, i) => (
              <li key={c.id}>
                <button type="button" className={`${i === index ? 'is-active' : ''} ${completed[c.id] ? 'is-done' : ''}`}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => store.setChallengeIndex(i)} title={KIND_LABEL[c.kind]}>
                  <span className="learn__step-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="learn__step-kind">{KIND_LABEL[c.kind]}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="learn__ladder-note">支援レベル {supportLevel(challenge.kind)} / 10 — 番号が進むほど支援が減ります。</p>
        </nav>

        <ChallengeRunner key={challenge.id} lesson={lesson} challenge={challenge} index={index} />
      </div>
    </div>
  );
}

interface RunnerProps { lesson: Lesson; challenge: Challenge; index: number }

function ChallengeRunner({ lesson, challenge, index }: RunnerProps) {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useSyncExternalStore(universe.subscribe, universe.getSnapshot);
  const isOrder = challenge.kind === 'order';
  const hasCode = Boolean(challenge.solution || challenge.code || ['build', 'debug', 'partial', 'fill', 'project', 'retrieve'].includes(challenge.kind));
  const hasOptions = Boolean(challenge.options?.length);

  const [code, setCode] = useState(() => challenge.starter ?? (challenge.kind === 'build' || challenge.kind === 'debug' || challenge.kind === 'partial' || challenge.kind === 'project' || challenge.kind === 'retrieve' || challenge.kind === 'fill' ? '' : (challenge.code ?? challenge.solution ?? '')));
  const [ordered, setOrdered] = useState<string[]>(() => challenge.lines ? shuffleLines(challenge.lines, challenge.id) : []);
  const [prediction, setPrediction] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ExecuteOutcome | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hints, setHints] = useState(0);
  const [patchSaved, setPatchSaved] = useState(Boolean(app.progress.patches.some((p) => p.text === challenge.patch)));
  const [loop, dispatch] = useReducer(loopReducer, undefined, initialLoopState);

  // Never seed a build/debug challenge with the solution — that would be an
  // accidental answer leak on "最初からやり直す".
  const initialCode = challenge.starter ?? (
    ['example', 'trace', 'predict'].includes(challenge.kind) && !challenge.options
      ? (challenge.code ?? '') : ''
  );

  function moveLine(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrdered(next);
  }

  function evaluate(): { ok: boolean; actual: string; out: ExecuteOutcome | null } {
    const predicted = selected ?? prediction;
    let ok = true;
    let actualParts: string[] = [];
    let out: ExecuteOutcome | null = null;

    if (hasOptions) {
      const right = isCorrectAnswer(predicted, challenge.answer ?? '');
      ok = ok && right;
      actualParts.push(challenge.answer ?? '');
    }

    let codeToRun = code;
    if (isOrder) codeToRun = ordered.join('\n');

    if (challenge.solution || isOrder) {
      out = universe.runSource(codeToRun, challenge.dialect, challenge.checkBorrows);
      setOutcome(out);
      const outputMatch = challenge.expectedOutput
        ? JSON.stringify(out.result.output) === JSON.stringify(challenge.expectedOutput) : true;
      const bodiesMatch = challenge.expectedBodies !== undefined
        ? out.result.bodyCount === challenge.expectedBodies : true;
      const errorsOk = out.errors.length === 0;
      ok = ok && errorsOk && outputMatch && bodiesMatch;
      actualParts.push(out.result.output.length > 0 ? out.result.output.join(' | ') : (out.errors[0]?.message ?? `天体 ${out.result.bodyCount} 体`));
    } else if (hasOptions && challenge.code) {
      // Intentionally broken prediction snippet: run it so the learner sees
      // the real diagnostic, but grading still comes from the chosen option.
      out = universe.runSource(codeToRun, challenge.dialect, challenge.checkBorrows);
      setOutcome(out);
      actualParts.push(out.errors[0]?.message ?? out.result.output.join(' | ') ?? '（出力なし）');
    }
    return { ok, actual: actualParts.join(' / '), out };
  }

  function submit() {
    const result = evaluate();
    const predicted = selected ?? prediction;
    if (revealed) {
      // Seeing the answer is not understanding. Require a fresh reproduction.
      setPassed(null);
      store.recordChallengeAttempt(challenge, predicted, result.actual, false);
      store.setToast('答えを見た状態では完了になりません。自分で書き直して実行してください。');
      return;
    }
    setPassed(result.ok);
    store.recordChallengeAttempt(challenge, predicted, result.actual, result.ok);
    const summary: RunSummary = {
      ok: result.ok,
      output: result.out?.result.output ?? [],
      errors: (result.out?.errors ?? []).map((e) => e.message),
      bodyCount: result.out?.result.bodyCount ?? universe.world.bodies.length,
      elapsedMs: result.out?.result.elapsedMs ?? 0,
    };
    dispatch({ type: 'PREDICT', value: predicted });
    dispatch({ type: 'EXECUTE', run: summary, actual: result.ok ? (predicted || result.actual) : result.actual });
  }

  function next() {
    if (index + 1 < lesson.challenges.length) store.setChallengeIndex(index + 1);
    else {
      const i = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
      const nextLesson = ALL_LESSONS[i + 1];
      if (nextLesson) store.gotoLesson(nextLesson.id, 0);
      else store.setToast('すべてのレッスンを完了しました');
    }
  }

  const errors = (outcome?.errors ?? []).map((e) => `${e.line}行: ${e.message}`);
  const actual = outcome
    ? (outcome.result.output.length > 0 ? outcome.result.output.join(' | ') : (errors[0] ?? `天体 ${outcome.result.bodyCount} 体`))
    : (challenge.answer ?? '');

  return (
    <article className="challenge" aria-labelledby="challenge-title">
      <header className="challenge__head">
        <div>
          <span className="challenge__kind">{KIND_LABEL[challenge.kind]}</span>
          <span className="challenge__phase">{PHASE_LABEL[loop.phase]}</span>
        </div>
        <h2 id="challenge-title">{challenge.prompt}</h2>
      </header>

      {challenge.reading && <div className="challenge__reading"><p>{challenge.reading}</p></div>}

      {challenge.code && !hasCode && (
        <pre className="challenge__code"><code>{challenge.code}</code></pre>
      )}

      {(hasCode || isOrder) && (
        <div className="challenge__editor">
          {isOrder ? (
            <div className="challenge__order">
              <p>▲ ▼ で行を並べ替えてください。</p>
              <ol>
                {ordered.map((line, i) => (
                  <li key={`${line}-${i}`}>
                    <button type="button" onClick={() => moveLine(i, -1)} aria-label={`${i + 1}行目を上へ`} disabled={i === 0}>▲</button>
                    <code>{line}</code>
                    <button type="button" onClick={() => moveLine(i, 1)} aria-label={`${i + 1}行目を下へ`} disabled={i === ordered.length - 1}>▼</button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <CodeEditor id={`ch-${challenge.id}`} value={code} onChange={setCode} dialect={challenge.dialect}
              label="課題のコード" onRun={submit} minLines={9} />
          )}
        </div>
      )}

      {hasOptions ? (
        <fieldset className="challenge__options">
          <legend>① 予測 — まず自分で選ぶ</legend>
          <div>
            {challenge.options!.map((opt) => (
              <label key={opt} className={selected === opt ? 'is-selected' : ''}>
                <input type="radio" name={`opt-${challenge.id}`} value={opt} checked={selected === opt}
                  onChange={() => setSelected(opt)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="challenge__prediction">
          <span>① 予測 — 結果を書いてから実行（空でも可）</span>
          <input type="text" value={prediction} maxLength={200} placeholder="例: 3 と表示される"
            onChange={(e) => setPrediction(e.target.value)} />
        </label>
      )}

      <div className="challenge__actions">
        <button type="button" className="primary" onClick={submit} disabled={hasOptions && selected === null}>
          ② 実行して確かめる
        </button>
        {challenge.hints && hints < challenge.hints.length && (
          <button type="button" onClick={() => setHints((h) => h + 1)}>ヒント {hints + 1}/{challenge.hints.length}</button>
        )}
        {challenge.solution && (
          <button type="button" onClick={() => { setRevealed(true); setCode(challenge.solution!); }}>
            答えを見る（完了扱いにはなりません）
          </button>
        )}
        <button type="button" onClick={() => {
          setCode(initialCode); setOutcome(null); setPassed(null); setSelected(null);
          setPrediction(''); setRevealed(false); setHints(0); dispatch({ type: 'RESET' });
          if (challenge.preset) universe.setPreset(challenge.preset);
        }}>最初からやり直す</button>
      </div>

      {hints > 0 && challenge.hints && (
        <ul className="challenge__hints">
          {challenge.hints.slice(0, hints).map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}

      {revealed && (
        <p className="challenge__reveal" role="status">
          答えを表示しました。これは<strong>完了扱いではありません</strong>。自分で書き直してもう一度実行してください。
        </p>
      )}

      {passed === false && (
        <ErrorLabPanel
          prediction={selected ?? prediction ?? '（予測なし）'}
          actual={actual}
          errors={errors}
          explanation={challenge.explanation}
          patch={challenge.patch}
          solution={revealed ? challenge.solution : undefined}
          patchSaved={patchSaved}
          onSavePatch={() => { store.savePatch(challenge); setPatchSaved(true); }}
          onRebuild={() => {
            setPassed(null); setOutcome(null); setSelected(null); setPrediction('');
            dispatch({ type: 'REBUILD' });
          }}
        />
      )}

      {passed === true && (
        <section className="challenge__success" role="status">
          <h3>③ 理解 — なぜそうなるか</h3>
          <p>{challenge.explanation}</p>
          {challenge.successNote && <p className="challenge__success-note">{challenge.successNote}</p>}
          <div className="challenge__patch">
            <span>1行パッチ</span>
            <code>{challenge.patch}</code>
            <button type="button" onClick={() => { store.savePatch(challenge); setPatchSaved(true); }} disabled={patchSaved}>
              {patchSaved ? '保存済み' : '復習に保存'}
            </button>
          </div>
          <div className="challenge__next">
            <button type="button" className="primary" onClick={next}>
              {index + 1 < lesson.challenges.length ? '次の課題へ →' : '次のレッスンへ →'}
            </button>
            <button type="button" onClick={() => store.navigate('review')}>復習キューを見る</button>
          </div>
        </section>
      )}

      <details className="challenge__concept">
        <summary>この概念の構造を見る（入力 → 判断 → 処理 → 結果 / 役割・不変条件・境界）</summary>
        <ConceptPanel conceptId={challenge.concept}
          onOpenChallenge={(id) => {
            const found = ALL_LESSONS.find((l) => l.challenges.some((c) => c.id === id));
            if (found) store.gotoLesson(found.id, found.challenges.findIndex((c) => c.id === id));
          }} />
      </details>
    </article>
  );
}
