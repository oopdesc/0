import { useEffect, useState } from 'react';
import { loadFlows, loadManifest } from './loader';
import type { Flow } from './types';
import './learning-v2.css';

export default function FlowView({search}:{search:string}) {
  const language = new URLSearchParams(search).get('lang') === 'rust' ? 'rust' : 'java';
  const [flows, setFlows] = useState<Flow[] | null>(null), [error, setError] = useState('');
  const [flowIndex, setFlowIndex] = useState(0), [stepIndex, setStepIndex] = useState(0), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setFlows(null);
    setFlowIndex(0); setStepIndex(0);
    loadManifest(language, controller.signal).then(m => loadFlows(m, controller.signal)).then(setFlows).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '読み込めません。'); });
    return () => controller.abort();
  }, [retry, language]);
  const flow = flows?.[flowIndex], step = flow?.steps[stepIndex];
  return <main className="zlv zlv-flow">
    <div className="zlv-topline"><span>0 / 処理をたどる</span><span>ブラウザから、応答が戻るまで</span></div>
    <header className="zlv-header"><div><span className="zlv-kicker">リクエストを追う ✳</span><h2>ひとつのリクエストを、<br />最後まで。</h2><p>入力・検証・処理・保存・応答。値がどこへ渡るのか、段階ごとに見てみましょう。</p></div><div className="zlv-summary"><span>題材</span><strong>{flows?.length ?? '—'}<small> シナリオ</small></strong><p>{language==='java'?'Java / HTTP / JDBC / H2':'Rust / HTTP / SQLite'}</p></div></header>
    <nav className="zlv-segments" aria-label="処理フローの言語"><a href="/learn?section=flow&lang=java" aria-current={language==='java'?'page':undefined}>Java / JDBC</a><a href="/learn?section=flow&lang=rust" aria-current={language==='rust'?'page':undefined}>Rust / SQLite</a></nav>
    <p className="zlv-build-note"><strong>この画面は処理の図解です。</strong> 用意した例を追跡します。実際の通信とDBの操作は、同梱ソースを手元で起動して確かめられます。</p>
    {error && <div className="zlv-placeholder" role="alert"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>読み直す</button></div>}
    {!flows && !error && <p role="status">題材を読み込んでいます…</p>}
    {flows && !flows.length && <p>このpackには処理の題材がまだありません。</p>}
    {flow && step && <>
      <div className="zlv-flow-route" aria-label="処理の経路">{['ブラウザ','HTTP',language==='java'?'Controller':'handler','Service','Repository',language==='java'?'JDBC / DB':'SQLite','JSON / 応答'].map((s,i) => <span key={s}>{s}{i < 6 && <i aria-hidden="true"> → </i>}</span>)}</div>
      <div className="zlv-flow-layout"><aside className="zlv-sidebar"><div className="zlv-aside-title"><div><span>題材</span><h3>6つの通り道</h3></div></div><p>同じ入口でも、入力や結果によって道が変わります。</p><ol className="zlv-flow-list">{flows.map((f,i) => <li key={f.id}><button type="button" aria-pressed={i === flowIndex} onClick={() => { setFlowIndex(i); setStepIndex(0); }}><span>{String(i + 1).padStart(2,'0')}</span>{f.title}</button></li>)}</ol></aside>
        <article className="zlv-card zlv-flow-card"><div className="zlv-card-top"><span>題材 {String(flowIndex + 1).padStart(2,'0')} / {String(flows.length).padStart(2,'0')}</span><span className="zlv-tag">段階 {stepIndex + 1} / {flow.steps.length}</span></div><h3>{flow.title}</h3><div className="zlv-flow-steps" aria-label="処理の段階">{flow.steps.map((s,i) => <button key={s.id} type="button" aria-current={i === stepIndex ? 'step' : undefined} onClick={() => setStepIndex(i)}>{String(i + 1).padStart(2,'0')}<span>{s.label}</span></button>)}</div><section className="zlv-flow-current" aria-live="polite"><span>段階 {String(stepIndex + 1).padStart(2,'0')}</span><h4>{step.label}</h4><p>{step.explanation}</p><dl>{Object.entries(step.variables).map(([k,v]) => <div key={k}><dt>{k}</dt><dd><code>{v}</code></dd></div>)}{step.status !== null && <div><dt>HTTP状態</dt><dd><code>{step.status}</code></dd></div>}</dl><a href={`/learning-v2/${language}/${step.sourceRef}`} target="_blank" rel="noreferrer">対応する同梱ソースを開く ↗</a><small>{step.sourceRef}</small></section><div className="zlv-next"><button disabled={stepIndex === 0} onClick={() => setStepIndex(i => i - 1)}>← 前の段階</button><button disabled={stepIndex === flow.steps.length - 1} onClick={() => setStepIndex(i => i + 1)}>次の段階 →</button></div><p className="zlv-related">先に復習できる問題: {flow.problemIds.map(id => <a key={id} href={`/learn?section=drill&lang=${language}&q=${encodeURIComponent(id)}`}>{id.replace('java:','')}</a>)}</p></article></div>
      <section className="zlv-backend-path" aria-labelledby="backend-path-title"><h3 id="backend-path-title">図から、実装へ。</h3><p>流れを見渡せたら、部品を一つずつ自分で書いて確かめます。</p><ol>{(language==='java' ? [['java:q43001','入力を分ける','パスとクエリを分け、値の検証へ進む。'],['java:q43006','応答をつくる','JSONとUTF-8のバイト数を区別する。'],['java:q43012','保存の境界へ','SQLへの値の束縛と、失敗時の後始末を確かめる。']] : [['rust:q42001','入力を借用する','文字列を複製せず、パスと値を取り出す。'],['rust:q42006','応答をつくる','Unicodeを保ってJSONの文字列を組み立てる。'],['rust:q42012','更新を検証する','可変借用の間に、版と失敗時の副作用を確認する。']]).map(([id,title,text],i)=><li key={id}><a href={'/learn?section=drill&lang='+language+'&q='+encodeURIComponent(id)}><small>0{i+1}</small><strong>{title} →</strong><span>{text}</span></a></li>)}</ol><p>ここでは関数の固定テストです。通信・DBの実接続は、下の手順や <a href={'/learn?section=projects&lang='+language}>小プロジェクト</a> で確認できます。</p></section>
      <div className="zlv-records"><div><span>手元で動かす</span><h3>手元で実際の流れを試す</h3><p>ソース一式の <code>{language==='java'?'backend/java-learning-v2':'projects/rust/book-api-http'}</code> で <code>{language==='java'?'mvn test':'cargo test -j2'}</code>。{language==='java'?'H2は専用のメモリ内DBです。':'SQLiteを使った保存と更新も試せます。'}手元でAPIを起動する場合のコマンドと注意は同梱のREADMEにあります。</p></div><div className="zlv-record-actions"><a href={`/learning-v2/${language}/examples/flow/README.md`} target="_blank" rel="noreferrer">実行手順を見る ↗</a></div></div>
      <p className="zlv-archive"><a href="/learn?section=legacy-flow">以前のブラウザ内モデルも見る →</a></p>
    </>}
  </main>;
}
