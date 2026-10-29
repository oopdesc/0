import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { compareOutput } from './comparison';
import { loadAliases, loadChunk, loadConcepts, loadExams, loadManifest } from './loader';
import { localGradeToken, runLocalGrade } from './localGrade';
import type { LocalGradeResult } from './localGrade';
import { buildExerciseArchive, canArchiveExercise } from './exerciseArchive';
import { emptyProgress, exportProgress, importProgress, loadProgress, markExposure, mergeProgress, recordKey, recordPrediction, recordRecall, recordCodeCheck, recordManualCodeCheck, saveDraft, saveLast, saveProgress } from './progress';
import type { Progress } from './progress';
import type { Concept, Exam, Lang, Manifest, Question } from './types';
import './learning-v2.css';

const LegacyProblems = lazy(() => import('../CuratedProblems'));
const ExamView = lazy(() => import('./ExamView'));
const DiagnosticView = lazy(() => import('./DiagnosticView'));
type View = 'all' | 'writing' | 'exams' | 'diagnostics';
const sectionOf = (view: View) => view === 'writing' ? 'writing' : view === 'exams' ? 'exams' : view === 'diagnostics' ? 'diagnostics' : 'drill';
function href(view: View, lang: Lang, id?: string, unit?: number): string {
  const p = new URLSearchParams({ section: sectionOf(view), lang });
  if (unit !== undefined) p.set('unit', String(unit));
  if (id) p.set('q', id);
  return `/learn?${p.toString()}`;
}
function download(name: string, text: string, mime: string) {
  const u = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function getStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
function message(e: unknown) { return e instanceof Error ? e.message : '教材の読み込みに失敗しました。'; }
function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => { const changed = () => setHash(window.location.hash); addEventListener('hashchange', changed); addEventListener('popstate', changed); return () => { removeEventListener('hashchange', changed); removeEventListener('popstate', changed); }; }, []);
  return hash;
}
function legacyFromHash(hash: string): string | null {
  const match = /^#\/p\/([^/?#]+)/.exec(hash); if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
function unitList(m: Manifest) {
  const ext = m.extensions?.units;
  return m.chunks.map((c, i) => {
    const u = Array.isArray(ext) ? ext.find(x => x.path === c.path && typeof x.title === 'string') : undefined;
    return { path: c.path, title: u?.title ?? `単元 ${String(i + 1).padStart(2, '0')}`, summary: u?.summary ?? '問題を一つずつ確認する' };
  });
}
function isCorrect(q: Question, selected: string[], text: string, order: string[]): boolean | null {
  const answer = q.answer;
  if (answer.mode === 'choice' || answer.mode === 'multichoice') {
    if (!answer.correctOptionIds.length || !selected.length) return null;
    return [...selected].sort().join('\0') === [...answer.correctOptionIds].sort().join('\0');
  }
  if (answer.mode === 'output' || answer.mode === 'trace') {
    if (answer.comparison === 'numeric' && typeof q.extensions?.numericTolerance !== 'number') return null;
    return compareOutput(text, answer.expectedOutput, answer.comparison, q.extensions?.numericTolerance as number | undefined);
  }
  if (answer.mode === 'order') {
    return answer.correctOrderIds.length > 0 && order.length === answer.correctOrderIds.length && order.every((x, i) => x === answer.correctOrderIds[i]);
  }
  return null;
}
function isValidAnswer(q: Question, selected: string[], text: string, order: string[]): boolean {
  if (q.answer.mode === 'choice') return selected.length === 1;
  if (q.answer.mode === 'multichoice') return selected.length > 0;
  if (q.answer.mode === 'order') return order.length > 0;
  if (q.answer.mode === 'output' || q.answer.mode === 'trace') return text.length > 0;
  return false;
}

export default function PackLearning({ search, view = 'all' }: { search: string; view?: View }) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const lang: Lang = params.get('lang') === 'rust' || params.get('track') === 'Rust' ? 'rust' : 'java';
  const hash = useHash();
  const requested = params.get('q') || legacyFromHash(hash);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [questionError, setQuestionError] = useState('');
  const [resolved, setResolved] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [exams, setExams] = useState<Exam[] | null>(null), [examError, setExamError] = useState('');
  const [reload, setReload] = useState(0);
  const storage = useMemo(getStorage, []);
  const [initial] = useState(() => storage ? loadProgress(storage) : { state: emptyProgress(), writable: false, error: 'ブラウザ保存を利用できません。' });
  const [progress, setProgress] = useState<Progress>(initial.state);
  const progressRef = useRef(progress); progressRef.current = progress;
  const [notice, setNotice] = useState(initial.error || '');
  const importRef = useRef<HTMLInputElement>(null);
  const [busyImport, setBusyImport] = useState(false);

  function update(fn: (s: Progress) => Progress) {
    let base = progressRef.current;
    let writable = !!storage && initial.writable;
    let blocked = '';
    if (storage && writable) {
      const current = loadProgress(storage);
      if (!current.writable) { writable = false; blocked = current.error || '既存の記録を読み取れません。'; }
      else {
        try { base = mergeProgress(current.state, base); }
        catch (e) { writable = false; blocked = message(e); }
      }
    }
    const next = fn(base);
    if (next === progressRef.current) return;
    progressRef.current = next; setProgress(next);
    if (!storage || !writable) { setNotice(`保存できません。今回の操作はこの画面を閉じると失われます。既存の記録は変更していません。${blocked}`); return; }
    const saved = saveProgress(storage, next); setNotice(saved.ok ? '' : saved.error || '保存できません。');
  }
  function mergeCurrentBeforeSave(next: Progress): Progress {
    if (!storage || !initial.writable) throw new Error('保存できないため取り込みを適用しません。');
    const current = loadProgress(storage);
    if (!current.writable) throw new Error(current.error || '既存の記録を読み取れません。');
    return mergeProgress(current.state, mergeProgress(progressRef.current, next));
  }
  async function mergeRaw(raw: string, local: Progress): Promise<Progress> {
    const aliases = manifest ? await loadAliases(manifest).catch(() => []) : [];
    const result = importProgress(raw, local, aliases);
    if (!result.ok) throw new Error(result.error);
    if (result.legacyOnly) setNotice('旧IDと日時を参照記録として追加しました。旧正答を新しい問題の合格には変換していません。');
    return result.state;
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_048_576) { setNotice('取り込み前に拒否しました：1MiBを超えています。既存記録はそのままです。'); return; }
    setBusyImport(true);
    try {
      const imported = await mergeRaw(await file.text(), progressRef.current);
      const next = mergeCurrentBeforeSave(imported);
      const saved = saveProgress(storage!, next); if (!saved.ok) throw new Error(saved.error || '保存に失敗しました。');
      progressRef.current = next; setProgress(next); setNotice('記録を統合しました。新しい記録・下書きと他言語の記録は、古い内容で上書きしていません。');
    } catch (e) { setNotice(`取り込みできません。既存記録はそのままです。${message(e)}`); }
    finally { setBusyImport(false); if (importRef.current) importRef.current.value = ''; }
  }
  async function inspectLegacy() {
    if (!storage || !initial.writable) { setNotice('旧記録を読み込めません。元の記録は変更していません。'); return; }
    setBusyImport(true);
    try {
      let next = progressRef.current, found = false;
      for (const key of ['0.academy.state.v1', 'cosmic.problems.progress.v1']) {
        const raw = storage.getItem(key); if (!raw) continue;
        found = true; next = await mergeRaw(raw, next);
      }
      if (!found) { setNotice('このブラウザには対象の旧記録がありません。'); return; }
      next = mergeCurrentBeforeSave(next);
      const saved = saveProgress(storage, next); if (!saved.ok) throw new Error(saved.error || '保存に失敗しました。');
      progressRef.current = next; setProgress(next);
      setNotice('旧IDと日時を参照記録として保存しました。元の記録は残し、未知IDも保留します。旧正答は新問題の合格に変換しません。');
    } catch (e) { setNotice(`旧記録は変更していません。${message(e)}`); }
    finally { setBusyImport(false); }
  }

  useEffect(() => {
    const controller = new AbortController(); setManifest(null); setManifestError(''); setQuestions(null); setConcepts([]); setExams(null); setExamError('');
    loadManifest(lang, controller.signal).then(m => { setManifest(m); }).catch(e => { if (!controller.signal.aborted) setManifestError(message(e)); });
    return () => controller.abort();
  }, [lang, reload]);
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    loadConcepts(manifest, controller.signal).then(setConcepts).catch(() => { if (!controller.signal.aborted) setConcepts([]); });
    if (view === 'exams') { setExamError(''); setExams(null); loadExams(manifest, controller.signal).then(setExams).catch(e => { if (!controller.signal.aborted) setExamError(message(e)); }); }
    return () => controller.abort();
  }, [manifest, view]);
  useEffect(() => {
    setResolved(null); setUnresolved(null);
    if (!manifest || !requested) return;
    if (manifest.chunks.some(c => c.ids.includes(requested))) { setResolved(requested); return; }
    const controller = new AbortController();
    loadAliases(manifest, controller.signal).then(aliases => {
      const source = params.get('source');
      const matches = aliases.filter(a => a.id === requested && (!source || a.source === source));
      if (matches.length === 1) setResolved(matches[0].targetId); else setUnresolved(requested);
    }).catch(() => { if (!controller.signal.aborted) setUnresolved(requested); });
    return () => controller.abort();
  }, [manifest, requested, params]);
  const selectedUnit = useMemo(() => {
    if (!manifest) return 0;
    const byId = resolved ? manifest.chunks.findIndex(c => c.ids.includes(resolved)) : -1;
    if (byId >= 0) return byId;
    const index = Number(params.get('unit') ?? 0);
    const selected = Number.isInteger(index) && index >= 0 && index < manifest.chunks.length ? index : 0;
    if (view === 'writing' && manifest.chunks[selected].writingIds?.length === 0) {
      const firstWriting = manifest.chunks.findIndex(c => (c.writingIds?.length ?? 1) > 0);
      return Math.max(0, firstWriting);
    }
    return selected;
  }, [manifest, resolved, params, view]);
  useEffect(() => {
    if (!manifest || view === 'exams' || view === 'diagnostics' || !manifest.chunks[selectedUnit]) return;
    const controller = new AbortController(); setQuestions(null); setQuestionError('');
    loadChunk(manifest, manifest.chunks[selectedUnit].path, controller.signal).then(setQuestions).catch(e => { if (!controller.signal.aborted) setQuestionError(message(e)); });
    return () => controller.abort();
  }, [manifest, selectedUnit, view]);
  const visible = questions?.filter(q => view !== 'writing' || q.writingRequired) ?? [];
  const current = visible.find(q => q.id === resolved) ?? visible[0] ?? null;
  useEffect(() => { if (storage && current && view !== 'exams' && view !== 'diagnostics') saveLast(storage, lang, current.id); }, [storage, lang, current, view]);
  const unitNames = manifest ? unitList(manifest) : [];
  const navigationUnits = unitNames.map((u,index) => ({...u,index})).filter(u => view !== 'writing' || manifest?.chunks[u.index].writingIds?.length !== 0);
  const allIds = manifest?.chunks.flatMap(c => view === 'writing' ? c.writingIds ?? c.ids : c.ids) ?? [];
  const index = current ? allIds.indexOf(current.id) : -1;
  const legacyPending = Object.values(progress.legacy).filter(x => !x.targetId).length;

  return <main className="zlv" aria-label="共通学習画面">
    <div className="zlv-topline"><span>0 / 学習のノート</span><span>自分の速さで、何度でも</span></div>
    <header className="zlv-header">
      <div><span className="zlv-kicker">手を動かして学ぶ <span>✳</span></span><h2>{view === 'exams' ? '試験で、理解を確かめる。' : view === 'diagnostics' ? 'これまでを、振り返る。' : view === 'writing' ? '小さく書いて、確かめる。' : 'ひとつずつ、わかるまで。'}</h2><p>予測して、理由を追って、自分の手で試す。どこからでも始められます。</p></div>
      <div className="zlv-summary" aria-live="polite"><span>選択中の教材</span><strong>{manifest ? manifest.counts.normal.toLocaleString() : '—'}<small> 問</small></strong><p>{lang === 'java' ? 'Java' : 'Rust'} {manifest ? ` / 記述 ${manifest.counts.writing}問` : ' / 読込中または未提供'}</p></div>
    </header>
    <div className="zlv-toolbar">
      <nav className="zlv-segments" aria-label="言語を選ぶ"><a href={href(view, 'java')} aria-current={lang === 'java' ? 'page' : undefined}>Java <span>↗</span></a><a href={href(view, 'rust')} aria-current={lang === 'rust' ? 'page' : undefined}>Rust <span>↗</span></a></nav>
      <nav className="zlv-views" aria-label="教材の種類"><a href={href('all', lang)} aria-current={view === 'all' ? 'page' : undefined}>すべて</a><a href={href('writing', lang)} aria-current={view === 'writing' ? 'page' : undefined}>コードを書く</a><a href={href('diagnostics', lang)} aria-current={view === 'diagnostics' ? 'page' : undefined}>途中確認</a><a href={href('exams', lang)} aria-current={view === 'exams' ? 'page' : undefined}>試験</a></nav>
    </div>
    {notice && <p className="zlv-notice" role="status">{notice}</p>}
    {!manifest && !manifestError && <div className="zlv-placeholder" role="status">教材の索引を読み込んでいます…</div>}
    {manifestError && <div className="zlv-placeholder"><h3>{lang === 'rust' ? 'Rustの新しいpackはまだ利用できません' : '教材を読み込めませんでした'}</h3><p>{manifestError}　公開時にpackがない場合や通信に失敗した場合は、ここでお知らせします。</p><button type="button" onClick={() => setReload(x => x + 1)}>もう一度読み込む</button>{lang === 'rust' && <p>以下は保管されている<strong>従来のRust演習</strong>です。新packの完成数には含めません。</p>}</div>}
    {manifestError && lang === 'rust' && <Suspense fallback={<p>従来教材を読み込んでいます…</p>}><LegacyProblems initialLanguage="rust" /></Suspense>}
    {manifest && <>
      <p className="zlv-build-note">問題はどこからでも選べます。解説を見た後の正答と、自分で思い出せた正答は分けて記録します。</p>
      {unresolved && <div className="zlv-notice">以前の問題「{unresolved}」は見直し中です。学習記録は残しています。一覧から新しい問題を選んでください。</div>}
      {requested && resolved && requested !== resolved && <p className="zlv-notice">旧ID「{requested}」は {resolved} に対応します。旧記録はそのまま残し、新しい記述の完了には数えません。</p>}
      {view === 'diagnostics' ? <Suspense fallback={<p>途中確認を読み込んでいます…</p>}><DiagnosticView manifest={manifest} progress={progress} update={update} /></Suspense> : view === 'exams' ? <>
        {examError && <div className="zlv-placeholder" role="alert"><p>{examError}</p><button type="button" onClick={() => setReload(x => x + 1)}>読み直す</button></div>}
        {!exams && !examError && <p role="status">試験の一覧を読み込んでいます…</p>}
        {exams && !exams.length && <section className="zlv-empty"><span>試験 / 準備中</span><h3>試験はまだ追加されていません。</h3><p>非公式の独自模試を用意する予定です。通常問題とは別に数え、自由に開ける形にします。</p><a href={href('all', lang)}>問題を選ぶ →</a></section>}
        {exams && exams.length > 0 && <Suspense fallback={<p>試験を読み込んでいます…</p>}><ExamView key={manifest.language+":"+params.get("exam")+":"+params.get("examQuestion")} manifest={manifest} exams={exams} initialExamId={params.get("exam")??undefined} initialQuestionId={params.get("examQuestion")??undefined} /></Suspense>}
      </> : <>
        {questionError && <div className="zlv-placeholder" role="alert"><p>{questionError}</p><button onClick={() => setReload(x => x + 1)}>読み直す</button></div>}
        <div className="zlv-layout">
          <aside className="zlv-sidebar" aria-label="単元と問題">
            <div className="zlv-aside-title"><div><span>学習の順路</span><h3>学習の道しるべ</h3></div><b>{String(navigationUnits.findIndex(u=>u.index===selectedUnit) + 1).padStart(2, '0')} / {String(navigationUnits.length).padStart(2, '0')}</b></div>
            <p>おすすめ順に並べています。好きなところから選べます。</p>
            <div className="zlv-units">{navigationUnits.map((u, i) => <a key={u.path} href={href(view, lang, undefined, u.index)} aria-current={u.index === selectedUnit ? 'step' : undefined}><span className="zlv-unit-num">{String(i + 1).padStart(2, '0')}</span><span><strong>{u.title.replace(/^\d+\s*/, '')}</strong><small>{view === 'writing' ? `コード記述 ${manifest.chunks[u.index].writingIds?.length ?? '—'}問` : u.summary}</small></span><span aria-hidden="true">↗</span></a>)}</div>
            <div className="zlv-list-head"><span>この単元の問題</span><b>{visible.length}問</b></div>
            {!questions && !questionError && <p>問題を読み込んでいます…</p>}
            {questions && !visible.length && <p>この単元に{view === 'writing' ? '記述問題は' : '問題は'}ありません。</p>}
            <ol className="zlv-problem-list">{visible.map((q) => <li key={q.id}><a href={href(view, lang, q.id)} aria-current={q.id === current?.id ? 'step' : undefined}><span>{String(q.order).padStart(2, '0')}</span><span>{q.title}<small>{q.writingRequired ? 'コードを書く' : '予測する'}</small></span><span aria-hidden="true">›</span></a></li>)}</ol>
            <div className="zlv-sidebar-foot">⌁ <span>前提に戻るのも、立派な一歩。</span></div>
          </aside>
          {current ? <QuestionPanel key={`${current.id}@${current.contentVersion}`} q={current} packVersion={manifest.contentVersion} lang={lang} view={view} concepts={concepts} progress={progress} update={update} prev={index > 0 ? allIds[index - 1] : null} next={index >= 0 && index < allIds.length - 1 ? allIds[index + 1] : null} /> : <div className="zlv-empty"><h3>問題を選んでください</h3><p>単元を選ぶと、その中の問題が表示されます。</p></div>}
        </div>
        <ConceptMap concepts={concepts} lang={lang} />
      </>}
      <section className="zlv-records"><div><span>学習の記録</span><h3>このブラウザに学習を残す</h3><p>予測、ヒント後の正答、後日の自己確認、コードの下書きは別々に扱います。アカウントや送信は不要です。</p><small>旧IDの参照 {Object.keys(progress.legacy).length}件（対応待ち {legacyPending}件）。表示設定と従来の記録は変更しません。</small></div><div className="zlv-record-actions"><button type="button" onClick={() => download('zero-learning-progress.json', exportProgress(progress), 'application/json')}>記録を書き出す</button><button type="button" disabled={busyImport} onClick={() => importRef.current?.click()}>記録を取り込む</button><button type="button" disabled={busyImport} onClick={() => void inspectLegacy()}>旧記録を参照する</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => void importFile(e.target.files?.[0])} /></div></section>
      <p className="zlv-archive"><a href="/learn?section=legacy-verified">ブラウザで動く例も見る →</a></p>
    </>}
  </main>;
}

type Update = (fn: (s: Progress) => Progress) => void;
function QuestionPanel({ q, packVersion, lang, view, concepts, progress, update, prev, next }: { q: Question; packVersion: string; lang: Lang; view: View; concepts: Concept[]; progress: Progress; update: Update; prev: string | null; next: string | null }) {
  const key = recordKey(q.id, q.contentVersion, q.writingRequired ? 'code' : 'prediction');
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [order, setOrder] = useState(() => [...q.answer.orderItems].reverse().map(x => x.id));
  const [draft, setDraft] = useState(() => progress.drafts[key]?.content ?? q.starter ?? q.setup.files.find(f => f.editable)?.content ?? '');
  const draftRef = useRef(draft); draftRef.current = draft;
  const questionRef = useRef(q); questionRef.current = q;
  const localToken = useMemo(() => localGradeToken(window.location, document), []);
  const [localResult, setLocalResult] = useState<LocalGradeResult | null>(null);
  const [localError, setLocalError] = useState(''), [grading, setGrading] = useState(false);
  const [archiveBusy,setArchiveBusy]=useState(false);
  const localSequence = useRef(0), localController = useRef<AbortController | null>(null), localBusy = useRef(false);
  useEffect(() => () => { localSequence.current++; localController.current?.abort(); }, []);
  async function exportExercise() {
    setArchiveBusy(true);
    try {
      const archive=await buildExerciseArchive(q,draftRef.current);
      const url=URL.createObjectURL(new Blob([new Uint8Array(archive).buffer],{type:'application/zip'}));
      const link=document.createElement('a');link.href=url;link.download='0-'+q.id.replace(':','-')+'-tests.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setFeedback('編集中のコード・固定テスト・実行手順をZIPへ保存しました。模範解答はreferenceフォルダです。');
    } catch(e) {setFeedback(e instanceof Error?e.message:'課題一式を保存できません。');}
    finally {setArchiveBusy(false);}
  }
  function invalidateLocal() {
    localSequence.current++; localController.current?.abort(); localController.current = null;
    localBusy.current = false; setGrading(false); setLocalResult(null); setLocalError('');
  }
  async function testLocal() {
    if (!localToken || localBusy.current) return;
    const code = draftRef.current, question = q, sequence = ++localSequence.current, controller = new AbortController();
    localController.current = controller; localBusy.current = true; setGrading(true); setLocalResult(null); setLocalError('');
    try {
      const result = await runLocalGrade(question, packVersion, code, localToken, controller.signal);
      if (localSequence.current === sequence && draftRef.current === code && questionRef.current === question) {
        setLocalResult(result);
        if(result.status!=='passed'||result.cases.length>0)update(s=>recordCodeCheck(s,key,result.status));
        setFeedback('この編集内容に対する固定テストの結果を表示しました。編集すると未実行に戻ります。');
      }
    } catch (e) {
      if (localSequence.current === sequence && !controller.signal.aborted) setLocalError(message(e));
    } finally {
      if (localSequence.current === sequence) { localController.current = null; localBusy.current = false; setGrading(false); }
    }
  }
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState('');
  const submitted = useRef(false);
  const record = progress.records[key];
  const conceptName = (id: string) => concepts.find(c => c.id === id)?.name ?? id;
  const before = isValidAnswer(q, selected, text, order);
  const showSolution = () => { update(s => markExposure(s, key, 'solution')); setSolution(true); };
  const submit = () => {
    if (!before || submitted.current) return;
    const ok = isCorrect(q, selected, text, order);
    if (ok === null) { setFeedback('この回答形式の判定条件はまだ利用できません。未判定として扱います。'); return; }
    submitted.current = true; setResult(ok); setSolution(true);
    setFeedback(ok ? '予測が合っています。理由と境界も確かめましょう。' : '予測と答えが違いました。どの規則を使うか一緒に見直しましょう。');
    update(s => recordPrediction(s, key, ok, Date.now(), solution||hints>0));
  };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= order.length) return; setOrder(old => { const a = [...old]; [a[i], a[j]] = [a[j], a[i]]; return a; }); };
  return <article className="zlv-card" aria-labelledby="zlv-question-title">
    <p className="zlv-question-links"><a href="/learn?section=today">今日の学習へ →</a>　<a href="/learn?section=concepts">概念図を開く →</a></p>
    <div className="zlv-card-top"><span>問題 {String(q.order).padStart(2, '0')} <i> / </i> {lang.toUpperCase()}</span><span className="zlv-tag">{q.writingRequired ? 'コード記述' : '結果を予測する'}</span></div>
    <div className="zlv-card-title"><div><p>ひとつ、考えてみよう。</p><h3 id="zlv-question-title">{q.title}</h3></div><span aria-hidden="true">✳</span></div>
    <p className="zlv-prompt">{q.prompt}</p>
    <div className="zlv-prereq"><span>この問題の前提</span>{q.prerequisiteConceptIds.length ? q.prerequisiteConceptIds.map(id => <a href="#zlv-concepts" key={id}>{conceptName(id)}</a>) : <em>ここから始められます</em>}</div>
    <div className="zlv-code-head"><span><i /> {q.setup.files[0]?.path ?? 'code'} <small> / {q.setup.languageVersion}</small></span><span>{q.writingRequired ? '編集できます' : '読むコード'}</span></div>
    {q.writingRequired ? <><label className="zlv-sr" htmlFor="zlv-editor">編集するコード</label><textarea id="zlv-editor" className="zlv-editor" spellCheck={false} value={draft} onChange={e => { const value = e.target.value; draftRef.current = value; invalidateLocal(); setDraft(value); update(s => saveDraft(s, key, value)); setFeedback('編集したコードはまだ実行していません。'); }} /><div className="zlv-code-actions"><button type="button" onClick={() => download(q.setup.files.find(f => f.editable)?.path.split('/').pop() || 'Main.java', draft, 'text/plain')}>編集したファイルを保存 ↓</button>{canArchiveExercise(q)&&<button type="button" disabled={archiveBusy} onClick={()=>void exportExercise()}>{archiveBusy?'保存の準備中…':'課題と固定テストを保存 ↓'}</button>}<span>下書きはこのブラウザに保存</span></div></> : <pre className="zlv-code" tabIndex={0}><code>{q.setup.files.map(f => f.content).join('\n')}</code></pre>}
    <details className="zlv-disclosure"><summary>実行の前提・この枠について</summary><p>{q.setup.note}</p><p>入口: <code>{q.setup.entryPoint}</code> / 追加依存: {q.setup.dependencies.length ? q.setup.dependencies.join(', ') : 'なし'}</p></details>
    {q.writingRequired ? <div className="zlv-write-note"><strong>{localResult ? 'このコードのローカル結果' : 'ここでは未実行・未判定'}</strong><p>公開版はコードをコンパイルしません。下書きや解説を使い、手元のJava／Rustコンパイラで確かめられます。固定コードの結果を編集内容の合格には使いません。</p>{localToken && (q.runnerProfile?.startsWith('java17-') || q.runnerProfile === 'rust2021-fixed-v1') && <div className="zlv-local-grade"><p>自分で起動したローカル版です。自分のコードだけを実行してください。OSによる完全な隔離はありません。</p><button type="button" disabled={grading} onClick={() => void testLocal()}>{grading ? '固定テストを実行中…' : 'このコードを手元でテストする'}</button>{localError && <p role="alert">{localError} 未判定のままです。</p>}{localResult && <section className="zlv-local-result" aria-label="ローカル採点結果" role="status"><p><strong>{({passed:'固定テストに合格',failed:'固定テストで差分あり','compile-error':'コンパイルエラー','runtime-error':'実行時エラー',timeout:'時間または出力の上限',unsupported:'コンパイラまたは課題が未対応','not-run':'未実行'})[localResult.status]}</strong> · 実行したケース {localResult.cases.length}件</p>{localResult.status==='runtime-error'&&<p>AssertionErrorやassertion failedは、固定テストの条件を満たさなかった場合にも出ます。下の「コンパイラなどの情報」で、最初の失敗を確かめてください。</p>}<p>この編集内容と固定テストを照合した一時結果です。有限のテストは仕様全体の証明ではなく、結果は画面を閉じると消えます。編集すると結果を無効にします。</p>{localResult.toolchain && <p>{localResult.toolchain.rustc || localResult.toolchain.javac} / {localResult.toolchain.target} / {localResult.toolchain.java?.split('\n')[0]}</p>}{localResult.cases.length > 0 && <details><summary>ケースごとの実測と期待値</summary><ol>{localResult.cases.map(c => <li key={c.id}><strong>{c.id}: {c.status}</strong><p>実測</p><pre>{c.actual.stdout.join('\n')}</pre><p>期待値</p><pre>{c.expectedComparison.expected.join('\n')}</pre></li>)}</ol></details>}{localResult.diagnostics.length > 0 && <details><summary>コンパイラなどの情報</summary><pre>{localResult.diagnostics.join('\n')}</pre></details>}</section>}</div>}{(q.runnerProfile?.startsWith('java17-') || q.runnerProfile === 'rust2021-fixed-v1') && <details><summary>手元でこの問題を採点する</summary><p>ソース一式を用意し、編集したファイルを <code>{lang === 'rust' ? 'main.rs' : 'Main.java'}</code> として保存。リポジトリのディレクトリで次を実行します。</p><pre><code>{`node contributions/shared-node/cli.mjs ${q.id} ${lang === 'rust' ? 'main.rs' : 'Main.java'}`}</code></pre><p>自分のコードだけを実行してください。これは公開サンドボックスではなく、OSによる完全な隔離もありません。</p></details>}<p>{String(q.extensions?.localGradingDisabledReason || "")}</p></div> : <section className="zlv-answer" aria-label="予測"><div className="zlv-answer-head"><div><span>自分の予測</span><h4>まず、自分で考えてみる。</h4></div><b>01</b></div>
      {(q.answer.mode === 'choice' || q.answer.mode === 'multichoice') && <fieldset className="zlv-options"><legend>{q.answer.mode === 'choice' ? '一つ選んでください' : '当てはまるものをすべて選んでください'}</legend>{q.answer.options.map((o, i) => <label key={o.id} className={selected.includes(o.id) ? 'selected' : ''}><input type={q.answer.mode === 'choice' ? 'radio' : 'checkbox'} name={`answer-${q.id}`} checked={selected.includes(o.id)} disabled={result !== null} onChange={() => setSelected(old => q.answer.mode === 'choice' ? [o.id] : old.includes(o.id) ? old.filter(x => x !== o.id) : [...old, o.id])} /><span className="zlv-option-num">{String.fromCharCode(65 + i)}</span><span>{o.text}</span><span className="zlv-check" aria-hidden="true">✓</span></label>)}</fieldset>}
      {(q.answer.mode === 'output' || q.answer.mode === 'trace') && <label className="zlv-output-label">出力を1行ずつ入力<textarea value={text} disabled={result !== null} onChange={e => setText(e.target.value)} rows={4} /><small>行・空白・大文字小文字・Unicodeを区別します。最後の改行だけは省略できます。</small></label>}
      {q.answer.mode === 'order' && <ol className="zlv-order">{order.map((id, i) => <li key={id}><code>{q.answer.orderItems.find(x => x.id === id)?.text ?? id}</code><button disabled={result !== null || i === 0} onClick={() => move(i, -1)} aria-label={`${i + 1}行目を上へ`}>↑</button><button disabled={result !== null || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`${i + 1}行目を下へ`}>↓</button></li>)}</ol>}
      <button className="zlv-primary" type="button" disabled={!before || result !== null} onClick={submit}>予測を確定する <span>→</span></button>
    </section>}
    <div className="zlv-hints"><div><span>ヒント</span><strong>少しだけ、手がかり。</strong></div>{q.hints.slice(0, hints).map(h => <p key={h.id}>{h.text}</p>)}{hints < q.hints.length && <button type="button" onClick={() => { update(s => markExposure(s, key, 'hint')); setHints(x => x + 1); }}>ヒント {hints + 1} を見る <span>＋</span></button>}</div>
    {feedback && <p className={`zlv-feedback ${result === true ? 'good' : ''}`} role="status">{feedback}</p>}
    {result !== null && <button type="button" className="zlv-reveal" onClick={() => { setSelected([]); setText(''); setResult(null); setSolution(false); setHints(0); submitted.current = false; setFeedback('解答を隠しました。同じ問題への再挑戦は、初回の予測とは分けて記録します。'); }}>解答を隠してもう一度</button>}
    {!solution && <button className="zlv-reveal" type="button" onClick={showSolution}>解答・考え方を見る <span>↗</span></button>}
    {solution && <section className="zlv-solution"><span>解答の考え方</span><h4>答えと、たどり方。</h4>
      {(q.answer.mode === 'choice' || q.answer.mode === 'multichoice') && <p className="zlv-correct">答え：{q.answer.correctOptionIds.map(id => q.answer.options.find(x => x.id === id)?.text ?? id).join('、')}</p>}
      {(q.answer.mode === 'output' || q.answer.mode === 'trace') && <pre>{q.answer.expectedOutput.join('\n')}</pre>}
      <p>{q.solution.explanation}</p><ol>{q.solution.reasoningSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      {q.solution.wrongReasons.length > 0 && <details><summary>ほかの選択肢を見直す</summary><ul>{q.solution.wrongReasons.map(reason => <li key={reason.optionId}><strong>{q.answer.options.find(o => o.id === reason.optionId)?.text ?? reason.optionId}</strong> — {reason.reason}</li>)}</ul></details>}
      {q.writingRequired && q.solution.files.map(f => <div key={f.path}><p><strong>模範コード · {f.path}</strong></p><pre><code>{f.content}</code></pre></div>)}
      <details><summary>境界と別解</summary><ul>{q.solution.boundaries.map((x, i) => <li key={`b${i}`}>{x}</li>)}{q.solution.alternativeCriteria.map((x, i) => <li key={`a${i}`}>{x}</li>)}</ul></details>
      {q.solution.references.length > 0 && <p className="zlv-ref">参照: {q.solution.references.filter(r => /^https:\/\//.test(r.url)).map(r => <a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>)}</p>}
    </section>}
    {q.writingRequired && q.tests.length > 0 && <details className="zlv-tests"><summary>テストの入力と期待値を見る（実測結果ではありません）</summary>{q.tests.flatMap(t => t.cases.map(c => <div key={`${t.id}-${c.id}`}><code>{c.stdin.trim() || '入力なし'}</code><span>→</span><code>{c.expectedStdout.join(' / ') || '出力なし'}</code></div>))}</details>}
    <details className="zlv-evidence"><summary>この教材の検査情報</summary>{q.evidence.compilerRun ? <p>{q.evidence.compilerRun.version} · {q.evidence.compilerRun.status} · {q.evidence.compilerRun.checkedAt}。検査したのは教材の提示コード／模範コードで、あなたの編集内容ではありません。</p> : <p>この問題のコンパイラ実測は未記録です。</p>}<p>仕様確認の記録: {q.evidence.specReviewed ? '記録あり' : '継続中'}。ブラウザ確認: {q.evidence.browserRun ? '記録あり' : '未記録'}。</p></details>
    {q.writingRequired && <p className="zlv-write-note"><button type="button" onClick={()=>{update(s=>recordManualCodeCheck(s,key));setFeedback('手元で結果を確認した自己記録を残しました。自動採点の合格とは分け、明日の復習候補にします。');}}>手元で実行して確かめた（自己記録）</button><small>このボタンはコンパイルや採点を行いません。下書きとは別に、復習の目安だけを残します。</small></p>}
    {record && <div className="zlv-progress">{q.writingRequired?<p>過去の固定テスト合格 {record.codePasses??0} · 固定テストでの差分/エラー {record.codeFailures??0} · 手元での確認（自己記録）{record.manualCodeChecks??0} · 後日の自己確認 {record.recalls}。過去の記録は、現在の編集内容の合格を表しません。</p>:<p>自力の予測正答 {record.blindCorrect} · 当日再挑戦/ヒント後の正答 {record.assistedCorrect} · 誤答 {record.wrong} · 後日の自己確認 {record.recalls}</p>}{record.dueAt && <p>次の復習目安: {new Date(record.dueAt).toLocaleDateString('ja-JP')}（初期案: 1・3・7・14・30日）</p>}{record.lastAttemptAt && <button type="button" onClick={() => { const old = progress.records[key]; const today = old?.lastAttemptAt && new Date(old.lastAttemptAt).toDateString() === new Date().toDateString(); if (today) setFeedback('後日の自己確認として、日を空けてから記録できます。'); else { update(s => recordRecall(s, key)); setFeedback('後日の自己確認として記録しました。コードの実行合格とは別です。'); } }}>後日、自力で説明できた（自己申告）</button>}</div>}
    <div className="zlv-next"><div>{prev && <a href={href(view, lang, prev)}>← 前の問題</a>}</div><div>{next && <a className="zlv-next-link" href={href(view, lang, next)}>次の問題へ <span>→</span></a>}</div></div>
    {q.relatedIds.length > 0 && <p className="zlv-related">関連する問題: {q.relatedIds.map(id => <a key={id} href={href('all', lang, id)}>{id.replace(`${lang}:`, '')}</a>)}</p>}
  </article>;
}
function ConceptMap({ concepts, lang }: { concepts: Concept[]; lang: Lang }) {
  if (!concepts.length) return null;
  return <details id="zlv-concepts" className="zlv-concepts"><summary><span>概念のつながり</span><strong>概念のつながりを見る</strong><i>＋</i></summary><p>必須の前提から、初めて扱う問題へ戻れます。関連の有無だけで理解度を判定しません。</p><div>{concepts.map(c => <article key={c.id}><span>{c.hardPrerequisiteIds.length ? c.hardPrerequisiteIds.map(id => concepts.find(x => x.id === id)?.name ?? id).join(' / ') + ' →' : 'はじまり'}</span><h4>{c.name}</h4><p>{c.summary}</p>{(c.introducedBy[0] || c.problemIds[0]) && <a href={href('all', lang, c.introducedBy[0] || c.problemIds[0])}>この概念の問題へ →</a>}</article>)}</div></details>;
}
