import type { Exam, Question } from './types';

export const EXAM_STORAGE_KEY = '0.learning-v2.exam-state.v1';
const MAX_BYTES = 1_048_576, MAX_ATTEMPTS = 200, MAX_DRAFT_BYTES = 65_536;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const safeId = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(s) && !['constructor','prototype','__proto__'].includes(s);
const safeOption = safeId;
const version = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(s);
const ts = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= Date.now() + 86_400_000;
export type ExamAttempt = { attemptId: string; examId: string; packVersion: string; examFingerprint: string | null; startedAt: number; deadlineAt: number; submittedAt: number | null; selections: Record<string, string[]>; drafts: Record<string, string>; marked: string[]; revealed: string[] };
export type ExamState = { schema: 'zero-exam-state/1'; attempts: ExamAttempt[] };
export const emptyExamState = (): ExamState => ({ schema:'zero-exam-state/1', attempts:[] });

/** Reject oversized/unsafe stored data before replacing anything in storage. */
export function parseExamState(raw: string): ExamState {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('試験記録が1MiBを超えています。');
  let input: unknown; try { input = JSON.parse(raw) as unknown; } catch { throw new Error('試験記録を読み取れません。'); }
  let nodes = 0;
  const inspect = (v: unknown, depth: number) => {
    if (++nodes > 50_000 || depth > 8) throw new Error('試験記録の入れ子または件数が上限を超えています。');
    if (!v || typeof v !== 'object') return;
    for (const [k,value] of Object.entries(v)) { if (['__proto__','constructor','prototype'].includes(k)) throw new Error('危険なプロパティ名が含まれています。'); inspect(value,depth+1); }
  };
  inspect(input,0);
  if (!object(input) || input.schema !== 'zero-exam-state/1' || !Array.isArray(input.attempts) || input.attempts.length > MAX_ATTEMPTS) throw new Error('試験記録の形式が不正です。');
  const seen = new Set<string>(); const attempts: ExamAttempt[] = [];
  for (const item of input.attempts) {
    if (!object(item) || typeof item.attemptId !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(item.attemptId) || seen.has(item.attemptId) || !safeId(item.examId) || !version(item.packVersion) || !(item.examFingerprint === undefined || item.examFingerprint === null || (typeof item.examFingerprint === 'string' && /^[a-f0-9]{64}$/.test(item.examFingerprint))) || !ts(item.startedAt) || !ts(item.deadlineAt) || (item.deadlineAt as number) < (item.startedAt as number) || (item.deadlineAt as number) - (item.startedAt as number) > 480*60_000 || !(item.submittedAt === null || (ts(item.submittedAt) && (item.submittedAt as number) >= (item.startedAt as number))) || !object(item.selections) || !object(item.drafts) || !Array.isArray(item.marked) || !Array.isArray(item.revealed)) throw new Error('試験の受験記録が不正です。');
    const lists = [item.marked,item.revealed];
    if (lists.some(list => list.length > 200 || new Set(list).size !== list.length || list.some(x => !safeId(x)))) throw new Error('見直し情報が不正です。');
    const selections: Record<string,string[]> = Object.create(null); const drafts: Record<string,string> = Object.create(null);
    if (Object.keys(item.selections).length > 200 || Object.keys(item.drafts).length > 200) throw new Error('試験回答が多すぎます。');
    for (const [id, value] of Object.entries(item.selections)) {
      if (!safeId(id) || !Array.isArray(value) || value.length > 20 || value.some(x => !safeOption(x)) || new Set(value).size !== value.length) throw new Error('選択回答が不正です。');
      selections[id] = value as string[];
    }
    for (const [id, value] of Object.entries(item.drafts)) {
      if (!safeId(id) || typeof value !== 'string' || new TextEncoder().encode(value).byteLength > MAX_DRAFT_BYTES) throw new Error('試験の下書きが不正です。');
      drafts[id] = value;
    }
    seen.add(item.attemptId);
    attempts.push({attemptId:item.attemptId,examId:item.examId,packVersion:item.packVersion,examFingerprint:typeof item.examFingerprint==='string'?item.examFingerprint:null,startedAt:item.startedAt as number,deadlineAt:item.deadlineAt as number,submittedAt:item.submittedAt as number|null,selections,drafts,marked:item.marked as string[],revealed:item.revealed as string[]});
  }
  return {schema:'zero-exam-state/1',attempts};
}
export function loadExamState(storage: Pick<Storage,'getItem'>): {state: ExamState; writable: boolean; error: string | null} {
  try { const raw=storage.getItem(EXAM_STORAGE_KEY); return {state:raw?parseExamState(raw):emptyExamState(),writable:true,error:null}; }
  catch(e) { return {state:emptyExamState(),writable:false,error:`既存の試験記録は変更しません。${e instanceof Error?e.message:''}`}; }
}
export function saveExamState(storage: Pick<Storage,'setItem'>, state: ExamState): {ok:boolean;error:string|null} {
  try { const raw=JSON.stringify(state);parseExamState(raw);storage.setItem(EXAM_STORAGE_KEY,raw);return {ok:true,error:null}; }
  catch(e) { return {ok:false,error:`保存できません。既存の試験記録は変更しません。${e instanceof Error?e.message:''}`}; }
}
export function startExam(state: ExamState, exam: Exam, packVersion: string, now: number, attemptId: string, fingerprint: string): ExamState {
  if (!safeId(exam.id) || !version(packVersion) || !/^[a-f0-9]{64}$/.test(fingerprint) || !/^[A-Za-z0-9._-]{1,100}$/.test(attemptId) || state.attempts.some(a=>a.attemptId===attemptId) || !Number.isInteger(exam.durationMinutes) || exam.durationMinutes < 1 || exam.durationMinutes > 480 || state.attempts.length >= MAX_ATTEMPTS) return state;
  return {...state,attempts:[...state.attempts,{attemptId,examId:exam.id,packVersion,examFingerprint:fingerprint,startedAt:now,deadlineAt:now+exam.durationMinutes*60_000,submittedAt:null,selections:{},drafts:{},marked:[],revealed:[]}]};
}
export function updateExam(state: ExamState, attemptId: string, change: (a:ExamAttempt)=>ExamAttempt): ExamState {
  const at=state.attempts.findIndex(a=>a.attemptId===attemptId);if(at<0 || state.attempts[at].submittedAt !== null)return state;
  const attempts=[...state.attempts];attempts[at]=change(attempts[at]);return {...state,attempts};
}
export async function fingerprintExam(exam: Exam, questions: Question[]): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('この環境では試験内容の照合に必要なSHA-256を使えません。');
  const withoutEvidence = questions.map(q => { const { evidence: ignored, ...content } = q; void ignored; return content; });
  const bytes = new TextEncoder().encode(JSON.stringify({exam,questions:withoutEvidence}));
  const digest = await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function gradeExamChoices(attempt: ExamAttempt, exam: Exam, questions: Question[]): {correct:number;total:number;unanswered:number;ungradedCode:number} {
  let correct=0,unanswered=0;
  for (const id of exam.choiceQuestionIds) {
    const q=questions.find(x=>x.id===id), selected=attempt.selections[id] ?? [];
    if (!q || !['choice','multichoice'].includes(q.answer.mode) || !q.answer.correctOptionIds.length) throw new Error('選択問題の採点条件が不正です。');
    if (!selected.length) { unanswered++; continue; }
    if (selected.every(x=>q.answer.options.some(o=>o.id===x)) && [...selected].sort().join('\0') === [...q.answer.correctOptionIds].sort().join('\0')) correct++;
  }
  return {correct,total:exam.choiceQuestionIds.length,unanswered,ungradedCode:exam.codeQuestionIds.length};
}

/** Restore exported attempts without replacing an existing submitted answer with an older draft. */
export function importExamState(raw:string,current:ExamState):{ok:true;state:ExamState;added:number;retained:number}|{ok:false;error:string}{
 try{
  const incoming=parseExamState(raw),safeCurrent=parseExamState(JSON.stringify(current));
  const attempts=[...safeCurrent.attempts],positions=new Map(attempts.map((a,i)=>[a.attemptId,i]));let added=0,retained=0;
  for(const next of incoming.attempts){
   const at=positions.get(next.attemptId);
   if(at===undefined){positions.set(next.attemptId,attempts.length);attempts.push(next);added++;continue;}
   const old=attempts[at];
   if(['examId','packVersion','examFingerprint','startedAt','deadlineAt'].some(k=>old[k as keyof ExamAttempt]!==next[k as keyof ExamAttempt]))throw Error('同じ受験IDに異なる試験内容が含まれています。');
   if(old.submittedAt===null&&next.submittedAt!==null)attempts[at]=next;
   else retained++;
  }
  const state=parseExamState(JSON.stringify({schema:'zero-exam-state/1',attempts}));
  return {ok:true,state,added,retained};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'取り込めません。'};}
}
