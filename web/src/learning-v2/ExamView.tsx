import { useEffect, useRef, useState } from 'react';
import { loadExamQuestions } from './loader';
import { emptyExamState, fingerprintExam, gradeExamChoices, importExamState, loadExamState, saveExamState, startExam, updateExam } from './examState';
import type { ExamAttempt, ExamState } from './examState';
import type { Exam, Manifest, Question } from './types';
import {reviewExam,reviewLabels} from './examReview';
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
  const [submitConfirm,setSubmitConfirm]=useState(false);
  const [reviewFilter,setReviewFilter]=useState<'needs'|'all'|'unanswered'|'revealed'>('needs');
  const importFileRef=useRef<HTMLInputElement>(null),questionArea=useRef<HTMLElement>(null);
  const exam=exams.find(e=>e.id===examId);
  const attempt=fingerprint?[...state.attempts].reverse().find(a=>a.examId===examId&&a.packVersion===manifest.contentVersion&&a.examFingerprint===fingerprint):undefined;
  const retained=state.attempts.filter(a=>a.examId===examId&&a.examFingerprint!==fingerprint).length;
  useEffect(()=>{
    if(!exam)return;const ctrl=new AbortController();setQuestions(null);setFingerprint('');setError('');setCurrent(0);setPreviewed([]);setSubmitConfirm(false);
    loadExamQuestions(manifest,exam,ctrl.signal).then(async qs=>({qs,digest:await fingerprintExam(exam,qs)})).then(value=>{if(!ctrl.signal.aborted){setQuestions(value.qs);setFingerprint(value.digest);}}).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'試験を読み込めません。');});
    return ()=>ctrl.abort();
  },[manifest,examId,reload]); // exam is selected by id from the validated list
  useEffect(()=>{if(!attempt||attempt.submittedAt!==null)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[attempt?.attemptId,attempt?.submittedAt]);
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
    setSubmitConfirm(false);if(!attempt)return;const time=Date.now();
    persist(s=>updateExam(s,attempt.attemptId,a=>time>=a.deadlineAt?{...a,submittedAt:time}:fn(a)));
  }
  useEffect(()=>{
    if(attempt&&attempt.submittedAt===null&&now>=attempt.deadlineAt) persist(s=>updateExam(s,attempt.attemptId,a=>({...a,submittedAt:Date.now()})));
  },[attempt?.attemptId,attempt?.submittedAt,attempt?.deadlineAt,now]);
  function begin() {
    if(!exam||!fingerprint)return;setSubmitConfirm(false);
    if(stateRef.current.attempts.length>=200){setNotice('試験記録の件数上限に達しました。既存記録は削除していません。');return;}
    const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():`attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    persist(s=>updateExam(startExam(s,exam,manifest.contentVersion,Date.now(),id,fingerprint),id,a=>({...a,revealed:previewed})));setCurrent(0);
  }
  async function restoreFile(file?:File){
    if(!file)return;
    try{if(file.size>1_048_576)throw Error('試験記録は1MiBまで取り込めます。');if(!storage)throw Error('このブラウザでは保存できません。');const currentState=loadExamState(storage);if(!currentState.writable)throw Error(currentState.error||'既存記録を読み取れません。');const result=importExamState(await file.text(),currentState.state);if(!result.ok)throw Error(result.error);const saved=saveExamState(storage,result.state);if(!saved.ok)throw Error(saved.error||'保存できません。');stateRef.current=result.state;setState(result.state);setNotice('試験記録を統合しました。新しく追加 '+result.added+'件、既存を優先 '+result.retained+'件。異なる内容の受験も保管します。');}catch(e){setNotice(e instanceof Error?e.message:'取り込めません。');}finally{if(importFileRef.current)importFileRef.current.value='';}
  }
  function openReview(index:number){setCurrent(index);requestAnimationFrame(()=>{questionArea.current?.focus({preventScroll:true});questionArea.current?.scrollIntoView({block:'start',behavior:'auto'});});}
  const q=questions?.[current], submitted=attempt?.submittedAt!==null && !!attempt;
  const remaining=attempt?Math.max(0,Math.min((exam?.durationMinutes??0)*60,Math.ceil((attempt.deadlineAt-now)/1000))):0;
  const summary=attempt&&submitted&&questions&&exam?gradeExamChoices(attempt,exam,questions):null;
  const review=attempt&&submitted&&questions&&exam?reviewExam(attempt,exam,questions,manifest):[];
  const choicesAnswered=attempt&&exam?exam.choiceQuestionIds.filter(id=>attempt.selections[id]?.length).length:0;
  const draftsWritten=attempt&&exam?exam.codeQuestionIds.filter(id=>attempt.drafts[id]?.trim()).length:0;
  const firstUnanswered=questions&&attempt&&exam?questions.findIndex(item=>exam.choiceQuestionIds.includes(item.id)&&!attempt.selections[item.id]?.length):-1;
  const visibleReview=review.filter(r=>reviewFilter==='all'||reviewFilter==='needs'&&r.status!=='correct'||reviewFilter==='unanswered'&&r.status==='unanswered'||reviewFilter==='revealed'&&r.revealed);
  return <section className="zlv-exams" aria-label="非公式模試">
    <p className="zlv-build-note"><strong>非公式の独自模試。</strong> 選択と実装は別集計です。解説はいつでも開けますが、見た場合はその受験で記録します。実装課題は下書き・模範解答の確認用です。公開画面では実行せず、選択問題の得点だけで実装も合格したとは扱いません。</p>
    <p><button type="button" onClick={()=>download('zero-exam-state.json',JSON.stringify(state,null,2))}>試験記録を書き出す ↓</button> <button type="button" onClick={()=>importFileRef.current?.click()}>試験記録を取り込む</button><input ref={importFileRef} type="file" accept="application/json,.json" hidden onChange={e=>void restoreFile(e.target.files?.[0])}/>{retained>0&&` 内容が異なる過去の受験 ${retained}件は保存し、今の問題には適用しません。`}</p>
    <div className="zlv-flow-layout"><aside className="zlv-sidebar" aria-label="試験一覧"><div className="zlv-aside-title"><div><span>試験</span><h3>試験を選ぶ</h3></div></div><ol className="zlv-flow-list">{exams.map(e=><li key={e.id}><button type="button" aria-pressed={e.id===examId} onClick={()=>setExamId(e.id)}><span>{e.form}</span>{levelNames[e.level]} {e.form} · {e.durationMinutes}分</button></li>)}</ol></aside>
      <article className="zlv-card zlv-exam-card">
        {exam && <>{exam.extensions?.note && <p className="zlv-write-note">{exam.extensions.note}</p>}<div className="zlv-card-top"><span>試験 / {manifest.language.toUpperCase()}</span><span className="zlv-tag">非公式</span></div><h3>{levelNames[exam.level]} {exam.form}</h3><p>選択 {exam.choiceQuestionIds.length}問 · 実装 {exam.codeQuestionIds.length}課題 · {exam.durationMinutes}分 · 選択 {exam.passingPercent}%を目安</p>
          {error&&<div role="alert" className="zlv-placeholder"><p>{error}</p><button onClick={()=>setReload(x=>x+1)}>読み直す</button></div>}
          {!questions&&!error&&<p role="status">試験問題を読み込んでいます…</p>}
          {questions&&!attempt&&<div className="zlv-write-note"><p>回答・見直し印・下書きはこのブラウザに保存します。制限時間が過ぎると提出します。解説は開始前にも下で確認できます。</p><button type="button" onClick={begin}>受験を始める</button><details onToggle={e=>{if(e.currentTarget.open)setPreviewed(questions.map(x=>x.id));}}><summary>受験前に全問題と解説を見る</summary>{questions.map(x=><section key={x.id}><h4>{x.title}</h4><p>{x.prompt}</p><pre><code>{x.setup.files.map(f=>f.content).join('\n')}</code></pre>{x.answer.options.length>0&&<ul>{x.answer.options.map(o=><li key={o.id}>{o.text}</li>)}</ul>}<p>答え: {x.answer.correctOptionIds.map(id=>x.answer.options.find(o=>o.id===id)?.text??id).join('、') || (x.writingRequired?'模範コードを参照':'設定なし')}</p><p>{x.solution.explanation}</p><ol>{x.solution.reasoningSteps.map((v,i)=><li key={i}>{v}</li>)}</ol>{x.solution.wrongReasons.map(r=><p key={r.optionId}>{x.answer.options.find(o=>o.id===r.optionId)?.text??r.optionId} — {r.reason}</p>)}{x.writingRequired&&x.solution.files.map(f=><pre key={f.path}><code>{f.content}</code></pre>)}<p>境界: {x.solution.boundaries.join(' / ')}</p><p>別解: {x.solution.alternativeCriteria.join(' / ')}</p></section>)}</details></div>}
          {attempt&&questions&&<>
            <div className="zlv-exam-status" role="status"><strong>{submitted?'提出済み':`残り ${Math.floor(remaining/60)}分 ${String(remaining%60).padStart(2,'0')}秒`}</strong><span>受験 {state.attempts.filter(a=>a.examId===exam.id&&a.packVersion===manifest.contentVersion).length}回目</span>{submitted&&<button type="button" onClick={begin}>もう一度受ける</button>}</div>
            {summary&&<div className={"zlv-feedback "+(summary.total&&summary.correct/summary.total*100>=exam.passingPercent?"good":"")}><strong>選択 {summary.correct} / {summary.total}</strong> · 未回答 {summary.unanswered} · {summary.total?Math.round(summary.correct/summary.total*100):0}%（目安 {exam.passingPercent}%）<p>解答を見た記録のない正答 {review.filter(r=>r.status==='correct'&&!r.revealed).length}問 · 解答を見た正答 {review.filter(r=>r.status==='correct'&&r.revealed).length}問。</p><p>実装 {summary.ungradedCode}課題は未実行・未判定。選択の結果と混ぜません。解説を見た問題 {attempt.revealed.length}件。</p></div>}
            {summary&&<section className="zlv-exam-review" aria-labelledby="exam-review-title"><div><h4 id="exam-review-title">今回の結果から、次の一歩へ</h4><p>間違えた箇所と未回答を確かめます。実装は選択の得点に含めず、手元での確認に進みます。</p></div><label>見直す問題<select value={reviewFilter} onChange={e=>setReviewFilter(e.target.value as typeof reviewFilter)}><option value="needs">誤答・未回答・実装</option><option value="all">すべて</option><option value="unanswered">未回答だけ</option><option value="revealed">解答を見た問題</option></select></label><ol>{visibleReview.map(row=><li key={row.id}><span className={'exam-result-tag result-'+row.status}>{reviewLabels[row.status]}</span><div><button type="button" onClick={()=>openReview(row.index)}>問題 {row.index+1}：{row.title} →</button>{row.revealed&&<small>解答を見た記録あり</small>}{row.marked&&<small>見直し印あり</small>}{row.practiceHref&&<a href={row.practiceHref} target="_blank" rel="noreferrer">元の問題で練習する ↗</a>}</div></li>)}</ol>{!visibleReview.length&&<p>この条件に当てはまる問題はありません。「すべて」で今回の回答を振り返れます。</p>}<p><a href="/learn?section=today">今日の学習へ →</a>　<a href="/learn?section=concepts">概念図でつながりを確かめる →</a></p></section>}
            {!submitted&&<div className="zlv-exam-answered"><span>選択の回答 {choicesAnswered} / {exam.choiceQuestionIds.length}問 · 実装の下書き {draftsWritten} / {exam.codeQuestionIds.length}課題</span><button type="button" disabled={firstUnanswered<0} onClick={()=>openReview(firstUnanswered)}>未回答の選択へ →</button></div>}
            <nav className="zlv-exam-nav" aria-label="問題へ移動">{questions.map((item,i)=><button type="button" key={item.id} aria-current={i===current?'step':undefined} onClick={()=>setCurrent(i)} className={attempt.selections[item.id]?.length||attempt.drafts[item.id]?.trim()?'is-answered':undefined} aria-label={`問題${i+1} ${exam.codeQuestionIds.includes(item.id)?(attempt.drafts[item.id]?.trim()?'下書きあり':'実装'):(attempt.selections[item.id]?.length?'回答あり':'未回答')}${attempt.marked.includes(item.id)?' 見直し':''}`}>{i+1}{attempt.marked.includes(item.id)?' •':''}</button>)}</nav>
            {q&&<section ref={questionArea} tabIndex={-1} className="zlv-exam-question"><div className="zlv-card-top"><span>問題 {current+1} / {questions.length}</span><button type="button" aria-pressed={attempt.marked.includes(q.id)} disabled={submitted} onClick={()=>changeAttempt(a=>({...a,marked:a.marked.includes(q.id)?a.marked.filter(x=>x!==q.id):[...a.marked,q.id]}))}>{attempt.marked.includes(q.id)?'見直し印を外す':'見直し印をつける'}</button></div><h4>{q.title}</h4><p>{q.prompt}</p>
              {q.writingRequired?<><label className="zlv-sr" htmlFor="exam-editor">実装の下書き</label><textarea id="exam-editor" className="zlv-editor" spellCheck={false} value={attempt.drafts[q.id]??q.starter??q.setup.files.find(f=>f.editable)?.content??''} readOnly={submitted} onChange={e=>{const value=e.target.value;changeAttempt(a=>({...a,drafts:{...a.drafts,[q.id]:value}}));}} /><div className="zlv-code-actions"><button type="button" onClick={()=>download(q.setup.files.find(f=>f.editable)?.path||'Main.java',attempt.drafts[q.id]??q.starter??'')}>編集ファイルを保存 ↓</button><span>実装は未判定</span></div><p>保存したコードは手元のIDEで実行してください。試験の実装課題は自動採点の対象外です。</p>{typeof q.extensions?.reusedFrom === "string" && <a href={`/learn?section=writing&lang=${manifest.language}&q=${encodeURIComponent(q.extensions.reusedFrom)}`} target="_blank" rel="noreferrer" onClick={()=>{if(!submitted&&!attempt.revealed.includes(q.id))changeAttempt(a=>({...a,revealed:[...a.revealed,q.id]}));}}>元の実装演習を別画面で開く（解答閲覧として記録） ↗</a>}</>:<><pre className="zlv-code"><code>{q.setup.files.map(f=>f.content).join('\n')}</code></pre><fieldset className="zlv-options"><legend>{q.answer.mode==='multichoice'?'当てはまるものをすべて選ぶ':'一つ選ぶ'}</legend>{q.answer.options.map((o,i)=>{const selected=attempt.selections[q.id]??[];return <label key={o.id} className={selected.includes(o.id)?'selected':''}><input type={q.answer.mode==='choice'?'radio':'checkbox'} name={`exam-${q.id}`} checked={selected.includes(o.id)} disabled={submitted} onChange={()=>changeAttempt(a=>{const old=a.selections[q.id]??[];return {...a,selections:{...a.selections,[q.id]:q.answer.mode==='choice'?[o.id]:old.includes(o.id)?old.filter(x=>x!==o.id):[...old,o.id]}};})} /><span className="zlv-option-num">{String.fromCharCode(65+i)}</span><span>{o.text}</span></label>;})}</fieldset></>}
              <details key={attempt.attemptId+":"+q.id} className="zlv-disclosure" open={submitted||undefined} onToggle={e=>{if(e.currentTarget.open&&!submitted&&!attempt.revealed.includes(q.id))changeAttempt(a=>({...a,revealed:[...a.revealed,q.id]}));}}><summary>解答・理由を自由に見る</summary>{q.answer.correctOptionIds.length>0&&<p>答え: {q.answer.correctOptionIds.map(id=>q.answer.options.find(o=>o.id===id)?.text??id).join('、')}</p>}<p>{q.solution.explanation}</p><ol>{q.solution.reasoningSteps.map((x,i)=><li key={i}>{x}</li>)}</ol>{q.solution.wrongReasons.map(x=><p key={x.optionId}>{q.answer.options.find(o=>o.id===x.optionId)?.text??x.optionId} — {x.reason}</p>)}{q.writingRequired&&q.solution.files.map(f=><pre key={f.path}><code>{f.content}</code></pre>)}<p>境界: {q.solution.boundaries.join(' / ')}</p><p>別解: {q.solution.alternativeCriteria.join(' / ')}</p></details>
              <div className="zlv-next"><button type="button" disabled={current===0} onClick={()=>setCurrent(i=>i-1)}>← 前へ</button><button type="button" disabled={current===questions.length-1} onClick={()=>setCurrent(i=>i+1)}>次へ →</button></div>
            </section>}
            {!submitted&&(submitConfirm?<div className="zlv-submit-confirm" role="group" aria-label="未回答の提出確認"><p>選択 {exam.choiceQuestionIds.length-choicesAnswered}問が未回答です。回答を続けるか、この状態で提出できます。</p><button type="button" onClick={()=>setSubmitConfirm(false)}>回答に戻る</button><button className="zlv-primary" type="button" onClick={()=>changeAttempt(a=>({...a,submittedAt:Date.now()}))}>未回答を残して提出する</button></div>:<button className="zlv-primary" type="button" onClick={()=>{if(firstUnanswered>=0)setSubmitConfirm(true);else changeAttempt(a=>({...a,submittedAt:Date.now()}));}}>提出する</button>)}
          </>}
        </>}
        {notice&&<p role="status" className="zlv-notice">{notice}</p>}
      </article>
    </div>
  </section>;
}
