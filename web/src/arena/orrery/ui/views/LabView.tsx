import { useReducer, useState, useSyncExternalStore } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { UniverseCanvas } from '../components/UniverseCanvas';
import { ErrorLabPanel } from '../components/ErrorLabPanel';
import { store } from '../../core/appStore';
import { universe } from '../../core/simulation/controller';
import { snippetsFor, defaultSnippet, type Snippet } from '../../core/lessons/snippets';
import { initialLoopState, loopReducer, LOOP_ORDER, PHASE_LABEL, type RunSummary } from '../../core/learning/loop';
import type { Dialect } from '../../core/lang';

type Tab = 'code' | 'state' | 'universe';

export function LabView() {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useSyncExternalStore(universe.subscribe, universe.getSnapshot);
  const [loop, dispatch] = useReducer(loopReducer, undefined, initialLoopState);
  const [traceIndex, setTraceIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('code');
  const [patchSaved, setPatchSaved] = useState(false);
  const lab = app.lab;
  const snippets = snippetsFor(lab.dialect);
  const result = lab.result?.result;

  function run() {
    const outcome = universe.runSource(lab.code[lab.dialect], lab.dialect, false);
    store.setLabResult(outcome);
    const actual = outcome.result.output.length > 0
      ? outcome.result.output.join(' | ')
      : (outcome.errors[0]?.message ?? `天体 ${outcome.result.bodyCount} 体`);
    const summary: RunSummary = {
      ok: outcome.result.ok && outcome.errors.length === 0,
      output: outcome.result.output,
      errors: outcome.errors.map((e) => `${e.phase === 'borrow' ? '借用チェック' : '行 ' + e.line}: ${e.message}`),
      bodyCount: outcome.result.bodyCount,
      elapsedMs: outcome.result.elapsedMs,
    };
    dispatch({ type: 'PREDICT', value: lab.prediction });
    dispatch({ type: 'EXECUTE', run: summary, actual });
    setTraceIndex(0);
    setPatchSaved(false);
  }

  function pickSnippet(s: Snippet) {
    store.setLabSnippet(s.id, s.code, s.dialect);
    dispatch({ type: 'RESET' });
    universe.setPaused(false);
  }

  function switchDialect(d: Dialect) {
    store.setLabDialect(d);
    const s = defaultSnippet(d);
    store.setLabSnippet(s.id, s.code, d);
    dispatch({ type: 'RESET' });
  }

  const errors = (lab.result?.errors ?? []).map((e) => `${e.line}行: ${e.message}`);
  const actual = result
    ? (result.output.length > 0 ? result.output.join(' | ') : (errors[0] ?? `天体 ${result.bodyCount} 体`))
    : '';
  const currentPhaseIndex = LOOP_ORDER.indexOf(loop.phase);

  return (
    <div className="lab">
      <header className="view-head">
        <div>
          <p className="view-head__kicker">コード実験室</p>
          <h1>コードの結果を、宇宙で確かめる。</h1>
          <p className="view-head__lead">
            短いコードを編集すると、天体の数や軌道が変わります。表示される数値を予測してから、実行してみてください。
          </p>
        </div>
        <div className="lab__switches">
          <div className="segmented" role="group" aria-label="言語選択">
            {(['java', 'rust'] as Dialect[]).map((d) => (
              <button key={d} type="button" className={lab.dialect === d ? 'is-active' : ''}
                aria-pressed={lab.dialect === d} onClick={() => switchDialect(d)}>
                {d === 'java' ? 'Java' : 'Rust'}
              </button>
            ))}
          </div>
          <label className="lab__snippet">
            <span>サンプル</span>
            <select value={lab.snippetId} onChange={(e) => {
              const s = snippets.find((x) => x.id === e.target.value);
              if (s) pickSnippet(s);
            }}>
              {snippets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="lab__predict">
        <label htmlFor="lab-prediction"><strong>① 予測</strong> 標準出力をそのまま予測する（例：42）。天体の変化は実行後に確かめます。</label>
        <div className="lab__predict-row">
          <input id="lab-prediction" type="text" value={lab.prediction}
            placeholder="例: 42" maxLength={200}
            onChange={(e) => store.setLabPrediction(e.target.value)} />
          <button type="button" className="primary" onClick={run}>② 実行する <span aria-hidden="true">↗</span></button>
        </div>
      </div>

      <div className="lab__tabs" role="tablist" aria-label="表示切り替え">
        {([['code', 'コード'], ['state', '実行・状態'], ['universe', '宇宙']] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className={`lab__grid lab__grid--${tab}`}>
        <section className="lab__pane lab__pane--code" aria-label="コード">
          <div className="pane-head"><h2>コード</h2><span>{lab.dialect === 'java' ? 'Java 21 風サブセット' : 'Rust 風サブセット'}</span></div>
          <CodeEditor id="lab-editor" value={lab.code[lab.dialect]} onChange={(v) => store.setLabCode(v)}
            dialect={lab.dialect} onRun={run} label="宇宙を操作するコード" minLines={16} />
          <div className="lab__actions">
            <button type="button" className="primary" onClick={run}>実行 (Ctrl/⌘+Enter)</button>
            <button type="button" onClick={() => pickSnippet(snippets.find((s) => s.id === lab.snippetId) ?? snippets[0]!)}>サンプルに戻す</button>
            <button type="button" onClick={() => { universe.resetWorld(); store.setLabResult(null); dispatch({ type: 'RESET' }); }}>宇宙をリセット</button>
          </div>
          {snippets.find((s) => s.id === lab.snippetId)?.note && (
            <p className="lab__snippet-note">{snippets.find((s) => s.id === lab.snippetId)?.note}</p>
          )}
        </section>

        <section className="lab__pane lab__pane--state" aria-label="実行結果と状態">
          <div className="pane-head"><h2>状態</h2><span>{result ? `${result.elapsedMs}ms / ${result.bodyCount} bodies` : '未実行'}</span></div>

          <ol className="phase-rail" aria-label="学習ループの現在位置">
            {LOOP_ORDER.map((p, i) => (
              <li key={p} className={i === currentPhaseIndex ? 'is-current' : i < currentPhaseIndex ? 'is-done' : ''}>
                <span>{i + 1}</span>{PHASE_LABEL[p]}
              </li>
            ))}
          </ol>

          <div className="state-block">
            <h3>標準出力</h3>
            {result && result.output.length > 0
              ? <pre className="state-output">{result.output.map((l, i) => <span key={i}>{l}<br /></span>)}</pre>
              : <p className="state-empty">出力なし。コードを実行するとここに表示されます。</p>}
          </div>

          {errors.length > 0 && (
            <div className="state-block state-block--error" role="alert">
              <h3>エラー / 借用チェック</h3>
              <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          {result && result.trace.length > 0 && (
            <div className="state-block">
              <h3>処理追跡 <span>({result.trace.length} steps)</span></h3>
              <label className="state-range">
                <span>ステップ {traceIndex + 1} / {result.trace.length}</span>
                <input type="range" min={0} max={result.trace.length - 1} value={traceIndex}
                  onChange={(e) => setTraceIndex(Number(e.target.value))} />
              </label>
              <p className="state-trace-line">{result.trace[traceIndex]?.line} 行目 — {result.trace[traceIndex]?.label}</p>
              <table className="state-vars">
                <tbody>
                  {(result.trace[traceIndex]?.vars ?? []).map(([name, val]) => (
                    <tr key={name}><th scope="row">{name}</th><td>{val}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && result.locals.length > 0 && (
            <div className="state-block">
              <h3>最終変数</h3>
              <table className="state-vars">
                <tbody>{result.locals.map(([name, val]) => <tr key={name}><th scope="row">{name}</th><td>{val}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          {(loop.phase === 'error' || loop.discrepancy) && (
            <ErrorLabPanel
              prediction={lab.prediction || '（予測なし）'}
              actual={actual}
              errors={errors}
              explanation="予測と実行結果が違う場合、ズレは「どこで仮定が壊れたか」を示します。標準出力・エラー行・変数の値を順に確認し、原因が生まれた行を特定してください。"
              patch="原因は『結果が出た行』ではなく『前提が決まった行』にあることが多い"
              solution={undefined}
              onSavePatch={() => {
                const s = snippets.find((x) => x.id === lab.snippetId);
                if (s) store.savePatch({ id: `lab-${s.id}`, kind: 'debug', dialect: lab.dialect, concept: 'sim-model', prompt: s.label, explanation: '', patch: '予測と結果の差は、前提が決まった行を疑う' });
                setPatchSaved(true);
                dispatch({ type: 'EXPLAIN' });
                dispatch({ type: 'PATCH' });
              }}
              patchSaved={patchSaved}
              onRebuild={() => { dispatch({ type: 'REBUILD' }); store.setLabPrediction(''); }}
            />
          )}
        </section>

        <section className="lab__pane lab__pane--universe" aria-label="宇宙シミュレーション">
          <div className="pane-head"><h2>宇宙</h2><span>コードの結果が反映されます</span></div>
          <UniverseCanvas />
        </section>
      </div>
    </div>
  );
}
