import { useEffect, useRef, useState } from 'react';
import { loadExamQuestions } from './loader';
import { emptyExamState, fingerprintExam, gradeExamChoices, loadExamState, saveExamState, startExam, updateExam } from './examState';
import type { ExamAttempt, ExamState } from './examState';
import type { Exam, Manifest, Question } from './types';
import './learning-v2.css';

const levelNames = { beginner: '初級', intermediate: '中級', advanced: '上級' };
function download(name: string, content: string) {
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name.split('/').pop() || 'Main.java';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ExamView({manifest,exams}:{manifest:Manifest;exams:Exam[]}) {
  const [examId,setExamId]=useState(exams[0]?.id ?? ''), [questions,setQuestions]=useState<Question[]|null>(null), [fingerprint,setFingerprint]=useState(''), [error,setError]=useState(''), [reload,setReload]=useState(0);
  const [current,setCurrent]=useState(0), [now,setNow]=useState(Date.now()), [previewed,setPreviewed]=useState<string[]>([]);
  const [storage]=useState(()=>{try{return window.localStorage;}catch{return null;}});
  const [initial]=useState(()=>storage?loadExamState(storage):{state:emptyExamState(),writable:false,error:'このブラウザでは試験記録を保存できません。'});
  const [state,setState]=useState<ExamState>(initial.state), stateRef=useRef(state);stateRef.current=state;
  const [notice,setNotice]=useState(initial.error||'');
  const exam=exams.find(e=>e.id===examId);
  const attempt=fingerprint?[...state.attempts].reverse().find(a=>a.examId===examId&&a.packVersion===manifest.contentVersion&&a.examFingerprint===fingerprint):undefined;
  const retained=state.attempts.filter(a=>a.examId===examId&&a.examFingerprint!==fingerprint).length;
  useEffect(()=>{
    if(!exam)return;const ctrl=new AbortController();setQuestions(null);setFingerprint('');setError('');setCurrent(0);setPreviewed([]);
    loadExamQuestions(manifest,exam,ctrl.signal).then(async qs=>({qs,digest:await fingerprintExam(exam,qs)})).then(value=>{if(!ctrl.signal.aborted){setQuestions(value.qs);setFingerprint(value.digest);}}).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'試験を読み込めません。');});
    return ()=>ctrl.abort();
  },[manifest,examId,reload]); // exam is selected by id from the validated list
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  function persist(change:(s:ExamState)=>ExamState) {
    let base=stateRef.current;
    if(storage&&initial.writable){
      const latest=loadExamState(storage);
      if(latest.writable) base=latest.state; else setNotice(latest.error||'既存の試験記録を変更しません。');
      if(!latest.writable){const next=change(base);stateRef.current=next;setState(next);return;}
    }
    const next=change(base);stateRef.current=next;setState(next);
    if(!storage||!initial.writable){setNotice('試験記録を保存できません。画面を閉じると今回の操作は失われます。');return;}
    const result=saveExamState(storage,next);setNotice(result.ok?'':result.error||'試験記録を保存できません。');
  }
  function changeAttempt(fn:(a:ExamAttempt)=>ExamAttempt) {
    if(!attempt)return;const time=Date.now();
    persist(s=>updateExam(s,attempt.attemptId,a=>time>=a.deadlineAt?{...a,submittedAt:time}:fn(a)));
  }
  useEffect(()=>{
    if(attempt&&attempt.submittedAt===null&&now>=attempt.deadlineAt) persist(s=>updateExam(s,attempt.attemptId,a=>({...a,submittedAt:Date.now()})));
  },[attempt?.attemptId,attempt?.submittedAt,attempt?.deadlineAt,now]);
  function begin() {
    if(!exam||!fingerprint)return;
    if(stateRef.current.attempts.length>=200){setNotice('試験記録の件数上限に達しました。既存記録は削除していません。');return;}
    const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():`attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    persist(s=>updateExam(startExam(s,exam,manifest.contentVersion,Date.now(),id,fingerprint),id,a=>({...a,revealed:previewed})));setCurrent(0);
  }
  const q=questions?.[current], submitted=attempt?.submittedAt!==null && !!attempt;
  const remaining=attempt?Math.max(0,Math.min((exam?.durationMinutes??0)*60,Math.ceil((attempt.deadlineAt-now)/1000))):0;
  const summary=attempt&&submitted&&questions&&exam?gradeExamChoices(attempt,exam,questions):null;
  return <section className="zlv-exams" aria-label="非公式模試">
    <p className="zlv-build-note"><strong>非公式の独自模試。</strong> 選択と実装は別集計です。解説はいつでも開けますが、見た場合はその受験で記録します。実装課題は下書き・模範解答の確認用です。公開画面では実行せず、選択問題の得点だけで実装も合格したとは扱いません。</p>
    <p><button type="button" onClick={()=>download('zero-exam-state.json',JSON.stringify(state,null,2))}>試験記録を書き出す ↓</button>{retained>0&&` 内容が異なる過去の受験 ${retained}件は保存し、今の問題には適用しません。`}</p>
    <div className="zlv-flow-layout"><aside className="zlv-sidebar" aria-label="試験一覧"><div className="zlv-aside-title"><div><span>試験</span><h3>試験を選ぶ</h3></div></div><ol className="zlv-flow-list">{exams.map(e=><li key={e.id}><button type="button" aria-pressed={e.id===examId} onClick={()=>setExamId(e.id)}><span>{e.form}</span>{levelNames[e.level]} {e.form} · {e.durationMinutes}分</button></li>)}</ol></aside>
      <article className="zlv-card zlv-exam-card">
        {exam && <>{exam.extensions?.note && <p className="zlv-write-note">{exam.extensions.note}</p>}<div className="zlv-card-top"><span>試験 / {manifest.language.toUpperCase()}</span><span className="zlv-tag">非公式</span></div><h3>{levelNames[exam.level]} {exam.form}</h3><p>選択 {exam.choiceQuestionIds.length}問 · 実装 {exam.codeQuestionIds.length}課題 · {exam.durationMinutes}分 · 選択 {exam.passingPercent}%を目安</p>
          {error&&<div role="alert" className="zlv-placeholder"><p>{error}</p><button onClick={()=>setReload(x=>x+1)}>読み直す</button></div>}
          {!questions&&!error&&<p role="status">試験問題を読み込んでいます…</p>}
          {questions&&!attempt&&<div className="zlv-write-note"><p>回答・見直し印・下書きはこのブラウザに保存します。制限時間が過ぎると提出します。解説は開始前にも下で確認できます。</p><button type="button" onClick={begin}>受験を始める</button><details onToggle={e=>{if(e.currentTarget.open)setPreviewed(questions.map(x=>x.id));}}><summary>受験前に全問題と解説を見る</summary>{questions.map(x=><section key={x.id}><h4>{x.title}</h4><p>{x.prompt}</p><pre><code>{x.setup.files.map(f=>f.content).join('\n')}</code></pre>{x.answer.options.length>0&&<ul>{x.answer.options.map(o=><li key={o.id}>{o.text}</li>)}</ul>}<p>答え: {x.answer.correctOptionIds.map(id=>x.answer.options.find(o=>o.id===id)?.text??id).join('、') || (x.writingRequired?'模範コードを参照':'設定なし')}</p><p>{x.solution.explanation}</p><ol>{x.solution.reasoningSteps.map((v,i)=><li key={i}>{v}</li>)}</ol>{x.solution.wrongReasons.map(r=><p key={r.optionId}>{x.answer.options.find(o=>o.id===r.optionId)?.text??r.optionId} — {r.reason}</p>)}{x.writingRequired&&x.solution.files.map(f=><pre key={f.path}><code>{f.content}</code></pre>)}<p>境界: {x.solution.boundaries.join(' / ')}</p><p>別解: {x.solution.alternativeCriteria.join(' / ')}</p></section>)}</details></div>}
          {attempt&&questions&&<>
            <div className="zlv-exam-status" role="status"><strong>{submitted?'提出済み':`残り ${Math.floor(remaining/60)}分 ${String(remaining%60).padStart(2,'0')}秒`}</strong><span>受験 {state.attempts.filter(a=>a.examId===exam.id&&a.packVersion===manifest.contentVersion).length}回目</span>{submitted&&<button type="button" onClick={begin}>もう一度受ける</button>}</div>
            {summary&&<div className="zlv-feedback good"><strong>選択 {summary.correct} / {summary.total}</strong> · 未回答 {summary.unanswered} · {summary.total?Math.round(summary.correct/summary.total*100):0}%（目安 {exam.passingPercent}%）<p>実装 {summary.ungradedCode}課題は未実行・未判定。選択の結果と混ぜません。解説を見た問題 {attempt.revealed.length}件。</p></div>}
            <nav className="zlv-exam-nav" aria-label="問題へ移動">{questions.map((item,i)=><button type="button" key={item.id} aria-current={i===current?'step':undefined} onClick={()=>setCurrent(i)} aria-label={`問題${i+1}${attempt.marked.includes(item.id)?' 見直し':''}`}>{i+1}{attempt.marked.includes(item.id)?' •':''}</button>)}</nav>
            {q&&<section className="zlv-exam-question"><div className="zlv-card-top"><span>問題 {current+1} / {questions.length}</span><button type="button" aria-pressed={attempt.marked.includes(q.id)} disabled={submitted} onClick={()=>changeAttempt(a=>({...a,marked:a.marked.includes(q.id)?a.marked.filter(x=>x!==q.id):[...a.marked,q.id]}))}>{attempt.marked.includes(q.id)?'見直し印を外す':'見直し印をつける'}</button></div><h4>{q.title}</h4><p>{q.prompt}</p>
              {q.writingRequired?<><label className="zlv-sr" htmlFor="exam-editor">実装の下書き</label><textarea id="exam-editor" className="zlv-editor" spellCheck={false} value={attempt.drafts[q.id]??q.starter??q.setup.files.find(f=>f.editable)?.content??''} readOnly={submitted} onChange={e=>{const value=e.target.value;changeAttempt(a=>({...a,drafts:{...a.drafts,[q.id]:value}}));}} /><div className="zlv-code-actions"><button type="button" onClick={()=>download(q.setup.files.find(f=>f.editable)?.path||'Main.java',attempt.drafts[q.id]??q.starter??'')}>編集ファイルを保存 ↓</button><span>実装は未判定</span></div><p>保存したコードは手元のIDEで実行してください。試験の実装課題は自動採点の対象外です。</p>{typeof q.extensions?.reusedFrom === "string" && <a href={`/learn?section=writing&lang=${manifest.language}&q=${encodeURIComponent(q.extensions.reusedFrom)}`} target="_blank" rel="noreferrer" onClick={()=>{if(!submitted&&!attempt.revealed.includes(q.id))changeAttempt(a=>({...a,revealed:[...a.revealed,q.id]}));}}>元の実装演習を別画面で開く（解答閲覧として記録） ↗</a>}</>:<><pre className="zlv-code"><code>{q.setup.files.map(f=>f.content).join('\n')}</code></pre><fieldset className="zlv-options"><legend>{q.answer.mode==='multichoice'?'当てはまるものをすべて選ぶ':'一つ選ぶ'}</legend>{q.answer.options.map((o,i)=>{const selected=attempt.selections[q.id]??[];return <label key={o.id} className={selected.includes(o.id)?'selected':''}><input type={q.answer.mode==='choice'?'radio':'checkbox'} name={`exam-${q.id}`} checked={selected.includes(o.id)} disabled={submitted} onChange={()=>changeAttempt(a=>{const old=a.selections[q.id]??[];return {...a,selections:{...a.selections,[q.id]:q.answer.mode==='choice'?[o.id]:old.includes(o.id)?old.filter(x=>x!==o.id):[...old,o.id]}};})} /><span className="zlv-option-num">{String.fromCharCode(65+i)}</span><span>{o.text}</span></label>;})}</fieldset></>}
              <details className="zlv-disclosure" onToggle={e=>{if(e.currentTarget.open&&!submitted&&!attempt.revealed.includes(q.id))changeAttempt(a=>({...a,revealed:[...a.revealed,q.id]}));}}><summary>解答・理由を自由に見る</summary>{q.answer.correctOptionIds.length>0&&<p>答え: {q.answer.correctOptionIds.map(id=>q.answer.options.find(o=>o.id===id)?.text??id).join('、')}</p>}<p>{q.solution.explanation}</p><ol>{q.solution.reasoningSteps.map((x,i)=><li key={i}>{x}</li>)}</ol>{q.solution.wrongReasons.map(x=><p key={x.optionId}>{q.answer.options.find(o=>o.id===x.optionId)?.text??x.optionId} — {x.reason}</p>)}{q.writingRequired&&q.solution.files.map(f=><pre key={f.path}><code>{f.content}</code></pre>)}<p>境界: {q.solution.boundaries.join(' / ')}</p><p>別解: {q.solution.alternativeCriteria.join(' / ')}</p></details>
              <div className="zlv-next"><button type="button" disabled={current===0} onClick={()=>setCurrent(i=>i-1)}>← 前へ</button><button type="button" disabled={current===questions.length-1} onClick={()=>setCurrent(i=>i+1)}>次へ →</button></div>
            </section>}
            {!submitted&&<button className="zlv-primary" type="button" onClick={()=>changeAttempt(a=>({...a,submittedAt:Date.now()}))}>提出する</button>}
          </>}
        </>}
        {notice&&<p role="status" className="zlv-notice">{notice}</p>}
      </article>
    </div>
  </section>;
}
