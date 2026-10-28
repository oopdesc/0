import { useEffect, useMemo, useRef, useState } from 'react';
import { getDiagnostics, loadDiagnosticQuestions } from './loader';
import { recordKey, recordPrediction } from './progress';
import type { Progress } from './progress';
import type { Manifest, Question } from './types';
import './learning-v2.css';

type Update = (fn: (s: Progress) => Progress) => void;
export default function DiagnosticView({manifest, progress, update}:{manifest:Manifest;progress:Progress;update:Update}) {
  const index = useMemo(()=>{try{return {list:getDiagnostics(manifest),error:''};}catch(e){return {list:[],error:e instanceof Error?e.message:'診断の索引を読めません。'};}},[manifest]);
  const [chosen,setChosen]=useState(''), [questions,setQuestions]=useState<Question[]|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const [answers,setAnswers]=useState<Record<string,string>>({}), [results,setResults]=useState<Record<string,boolean>>({});
  const submitted=useRef(new Set<string>());
  const diagnostic=index.list.find(d=>d.id===chosen) ?? index.list[0];
  useEffect(()=>{
    if(!diagnostic)return;const ctrl=new AbortController();setQuestions(null);setError('');setAnswers({});setResults({});submitted.current.clear();
    loadDiagnosticQuestions(manifest,diagnostic,ctrl.signal).then(setQuestions).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'診断を読み込めません。');});
    return ()=>ctrl.abort();
  },[manifest,diagnostic?.id,retry]);
  function submit(q:Question) {
    const selected=answers[q.id];if(!selected||submitted.current.has(q.id))return;
    submitted.current.add(q.id);const ok=q.answer.correctOptionIds.length===1&&selected===q.answer.correctOptionIds[0];
    setResults(old=>({...old,[q.id]:ok}));update(s=>recordPrediction(s,recordKey(q.id,q.contentVersion,'prediction'),ok));
  }
  const answered=Object.keys(results).length, correct=Object.values(results).filter(Boolean).length;
  return <section className="zlv-diagnostic" aria-label="既習問題の途中確認">
    <p className="zlv-build-note"><strong>既習問題の振り返り。</strong> 通常問題を再利用し、通常の件数に追加しません。級を修了したという判定やロックはありません。</p>
    {index.error&&<div role="alert" className="zlv-placeholder">{index.error}</div>}
    {!index.error&&!index.list.length&&<section className="zlv-empty"><h3>このpackの診断は準備中です。</h3><p>未提供の級や言語を完成扱いにしません。</p></section>}
    {diagnostic&&<><label htmlFor="zlv-diagnostic-select">振り返る範囲</label> <select id="zlv-diagnostic-select" value={diagnostic.id} onChange={e=>setChosen(e.target.value)}>{index.list.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select>
      <h3>{diagnostic.title}</h3><p>{diagnostic.description}</p>
      {error&&<div role="alert" className="zlv-placeholder"><p>{error}</p><button type="button" onClick={()=>setRetry(i=>i+1)}>読み直す</button></div>}
      {!questions&&!error&&<p role="status">既習問題を読み込んでいます…</p>}
      {questions&&<><p role="status">この画面で回答 {answered} / {questions.length}問 · 正解 {correct}問。回答は各通常問題の記録へ保存します。画面内の集計は再読込でリセットされます。</p>
        <button type="button" onClick={()=>{submitted.current.clear();setAnswers({});setResults({});}}>もう一度（学習記録は残す）</button>
        <div className="zlv-diagnostic-list">{questions.map((q,i)=>{const rec=progress.records[recordKey(q.id,q.contentVersion,'prediction')], done=Object.prototype.hasOwnProperty.call(results,q.id);return <article className="zlv-card" key={q.id}>
          <div className="zlv-card-top"><span>確認 {i+1} / {questions.length}</span><span>{q.id}</span></div><h4>{q.title}</h4><p>{q.prompt}</p>
          <pre className="zlv-code"><code>{q.setup.files.map(f=>f.content).join('\n')}</code></pre>
          <fieldset className="zlv-options"><legend>一つ選ぶ</legend>{q.answer.options.map((o,j)=><label key={o.id} className={answers[q.id]===o.id?'selected':''}><input type="radio" name={`diagnostic-${q.id}`} value={o.id} checked={answers[q.id]===o.id} disabled={done} onChange={()=>setAnswers(old=>({...old,[q.id]:o.id}))} /><span className="zlv-option-num">{String.fromCharCode(65+j)}</span><span>{o.text}</span></label>)}</fieldset>
          {!done?<button type="button" disabled={!answers[q.id]} onClick={()=>submit(q)}>第{i+1}問を確定</button>:<div className={`zlv-feedback ${results[q.id]?'good':'bad'}`} role="status"><strong>{results[q.id]?'予測が合っています。':'予測を見直しましょう。'}</strong><p>{q.solution.explanation}</p>{!results[q.id]&&<p>{q.solution.wrongReasons.find(r=>r.optionId===answers[q.id])?.reason}</p>}<p>境界: {q.solution.boundaries.join(' / ')}</p></div>}
          {rec&&<p className="zlv-diagnostic-history">通常問題の記録: 自力 {rec.blindCorrect}回 / 補助あり {rec.assistedCorrect}回 / 誤答 {rec.wrong}回。過去の正解回数だけで現在の習得を保証しません。</p>}
          <a href={`/learn?section=drill&lang=${manifest.language}&q=${encodeURIComponent(q.id)}`}>問題と詳しい解説へ →</a>
        </article>;})}</div>
      </>}
    </>}
  </section>;
}
