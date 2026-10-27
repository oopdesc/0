import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { LESSONS, getLesson } from '../domain/lessons';
import { isRebuildSatisfied, predictionMatches, runLesson } from '../domain/runner';
import { formatDue, type ProgressState } from '../domain/progress';
import type { LessonId, RunResult } from '../domain/types';
import { CodeEditor } from './CodeEditor';
interface Props { selected: LessonId; progress: ProgressState; onSchedule: (id: LessonId, success: boolean) => void; onOpenMission: (id: LessonId) => void }
export function Review({ selected, progress, onSchedule, onOpenMission }: Props) {
  const [id, setId] = useState<LessonId>(selected);
  const [prediction, setPrediction] = useState(''); const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<RunResult | null>(null); const [correct, setCorrect] = useState(false);
  const [rebuild, setRebuild] = useState(''); const [rebuildResult, setRebuildResult] = useState<RunResult | null>(null);
  const [scheduled, setScheduled] = useState(false); const [notice, setNotice] = useState('');
  const lesson = getLesson(id); const current = progress.lessons[id];
  const reset = (next: LessonId) => { setId(next); setPrediction(''); setExplanation(''); setResult(null); setCorrect(false); setRebuild(''); setRebuildResult(null); setScheduled(false); setNotice(''); };
  const check = (event: FormEvent) => {
    event.preventDefault();
    if (!prediction.trim() || explanation.trim().length < 3) { setNotice('予測と、自分の言葉での説明を入力してください。'); return; }
    const run = runLesson(id, lesson.reviewCode); setResult(run); setCorrect(predictionMatches(prediction, run)); setNotice('');
  };
  const checkRebuild = () => { const r = runLesson(id, rebuild); setRebuildResult(r); };
  const finish = (remembered: boolean) => { const success = remembered && correct && !!rebuildResult && isRebuildSatisfied(id, rebuildResult); onSchedule(id, success); setScheduled(true); };
  return <section className="review-section shell section-space" id="review" aria-labelledby="review-title">
    <div className="section-heading"><div><p className="eyebrow"><span className="accent">04</span> / RETURN TO ORBIT</p><h2 id="review-title">思い出すたび、<br />理解は自分のものになる。</h2></div><p className="section-description">答えを見る前に、思い出す。<br />短い間隔から、少しずつ先へ。</p></div>
    <div className="review-layout"><div className="review-aside"><span className="review-orbit-icon" aria-hidden="true"><span /></span><p className="eyebrow">SPACED RECALL</p><h3>答えを閉じて、<br />もう一度。</h3><p>予測 → 自分の言葉 → 再実装。復習の結果と自己評価から、次の間隔を決めます。</p><div className="review-local"><span className="status-dot" /> 回答本文は保存・送信しません。</div></div>
      <div className="review-main"><div className="review-top"><div><span className="eyebrow">RECALL EXERCISE / {lesson.language.toUpperCase()}</span><h3>{lesson.title}</h3></div><label>問題を選ぶ <select aria-label="復習するミッション" value={id} onChange={(e) => reset(e.target.value as LessonId)}>{LESSONS.map((l) => <option value={l.id} key={l.id}>{l.language} / {l.title}</option>)}</select></label></div>
        <div className="review-due"><span>次回の目安</span><strong>{formatDue(current.dueAt)}</strong><span>{current.savedPatch ? 'この概念の1行パッチを復習に利用' : '記録がなくても今すぐ挑戦できます'}</span></div>
        {!result ? <form onSubmit={check} className="review-form"><p className="review-question">{lesson.reviewPrompt}</p><pre className="review-code" tabIndex={0} aria-label="復習問題のコード"><code>{lesson.reviewCode}</code></pre><label htmlFor="review-prediction">結果の予測</label><input id="review-prediction" value={prediction} maxLength={80} autoComplete="off" onChange={(e) => setPrediction(e.target.value)} placeholder="出力値、またはエラー" /><label htmlFor="review-explanation">なぜそうなる？ 自分の言葉で</label><textarea id="review-explanation" value={explanation} maxLength={1000} onChange={(e) => setExplanation(e.target.value)} placeholder="理由を短く説明してみよう" /><div className="review-form-bottom"><p aria-live="polite">{notice || '説明文は自動採点されず、保存もされません。'}</p><button className="button button-primary" type="submit">予測を確かめる <ArrowRight size={15} /></button></div></form> : <div className="review-result" aria-live="polite"><span className="eyebrow">{correct ? 'PREDICTION MATCHED' : 'REVISIT THE DIFFERENCE'}</span><h4>{correct ? '予測が一致しました。' : 'もう一度、違いを見てみよう。'}</h4><p>あなたの予測：<b>{prediction}</b> <span>→</span> 実際：<b className="actual-output">{result.actual}</b></p><p>{result.explanation}</p><div className="review-patch"><small>ONE-LINE PATCH</small><strong>{lesson.patch}</strong></div>
          {!scheduled && <><div className="review-rebuild"><div><p className="eyebrow">NEXT / RECONSTRUCT</p><h4>答えを閉じて、再実装。</h4><p>{lesson.rebuildPrompt}</p><p className="review-help">{lesson.editGuide}</p></div><CodeEditor id="review-code-editor" language={lesson.language} value={rebuild} onChange={(v) => { setRebuild(v); setRebuildResult(null); }} onReset={() => { setRebuild(''); setRebuildResult(null); }} /><button className="button button-outline" type="button" onClick={checkRebuild}>再実行して確かめる <ArrowUpRight size={15} /></button>{rebuildResult && <p className="rebuild-result" role="status">{isRebuildSatisfied(id, rebuildResult) ? '再実装の条件を満たしました。' : rebuildResult.status === 'unsupported' ? `実行していません：${rebuildResult.explanation}` : '指定された入力・条件・出力をもう一度確認してください。'}</p>}</div>
          <div className="self-rate"><h4>自分で思い出せましたか？</h4><p>予測と再実装が両方正しく、かつ「思い出せた」の場合のみ間隔を延ばします。それ以外は約10分後。</p><div><button type="button" className="button button-primary" disabled={!rebuildResult} onClick={() => finish(true)}>思い出せた</button><button type="button" className="button button-outline" onClick={() => finish(false)}>難しかった</button></div></div></>}
          {scheduled && <div className="scheduled" role="status"><strong>次回の目安：{formatDue(progress.lessons[id].dueAt)}</strong><p>記録はこの端末にのみ保存されます。</p><button type="button" onClick={() => reset(id)}>もう一度挑戦する <ArrowRight size={14} /></button></div>}
        </div>}
        <button type="button" className="review-open-lab" onClick={() => onOpenMission(id)}>実験室でこの概念を学び直す <ArrowUpRight size={14} /></button>
      </div></div>
  </section>;
}
