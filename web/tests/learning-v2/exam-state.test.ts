import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyExamState, EXAM_STORAGE_KEY, fingerprintExam, gradeExamChoices, loadExamState, parseExamState, saveExamState, startExam, updateExam } from '../../src/learning-v2/examState';
import type { Exam, Question } from '../../src/learning-v2/types';
const exam=JSON.parse(readFileSync(new URL('./fixtures/exam-fixture.json',import.meta.url),'utf8'))[0] as Exam;
const questions=JSON.parse(readFileSync(new URL('./fixtures/exam-questions-fixture.json',import.meta.url),'utf8')) as Question[];
const now=Date.now(), choice=questions.find(q=>q.id===exam.choiceQuestionIds[0])!;

test('exam timer, stable choices, code as ungraded, review and retakes are separate',()=>{
 let state=startExam(emptyExamState(),exam,'fixture-1',now,'attempt-1','a'.repeat(64));
 assert.equal(state.attempts[0].deadlineAt,now+65*60_000);
 state=updateExam(state,'attempt-1',a=>({...a,selections:{[choice.id]:choice.answer.correctOptionIds},marked:[choice.id],drafts:{[exam.codeQuestionIds[0]]:'class Main {}'}}));
 assert.deepEqual(gradeExamChoices(state.attempts[0],exam,questions),{correct:1,total:1,unanswered:0,ungradedCode:1});
 state=updateExam(state,'attempt-1',a=>({...a,submittedAt:now+1000}));
 assert.equal(updateExam(state,'attempt-1',a=>({...a,marked:[]})),state);
 state=startExam(state,exam,'fixture-1',now+2000,'attempt-2','a'.repeat(64));assert.equal(state.attempts.length,2);assert.equal(state.attempts[0].drafts[exam.codeQuestionIds[0]],'class Main {}');
 const restored=parseExamState(JSON.stringify(state));assert.equal(restored.attempts.length,2);assert.equal(restored.attempts[0].marked[0],choice.id);
 const old=JSON.parse(JSON.stringify(state));delete old.attempts[0].examFingerprint;assert.equal(parseExamState(JSON.stringify(old)).attempts[0].examFingerprint,null);
});

test('corrupt, oversized, dangerous, invalid timestamps never erase existing storage',()=>{
 const storage=new Map([[EXAM_STORAGE_KEY,'{broken']]);
 const loaded=loadExamState({getItem:k=>storage.get(k)??null});assert.equal(loaded.writable,false);assert.equal(storage.get(EXAM_STORAGE_KEY),'{broken');
 for (const raw of ['x'.repeat(1_048_577),'{"schema":"zero-exam-state/1","attempts":[],"__proto__":{"polluted":true}}',JSON.stringify({schema:'zero-exam-state/1',attempts:[{attemptId:'x',examId:exam.id,packVersion:'1',startedAt:now,deadlineAt:now-1,submittedAt:null,selections:{},drafts:{},marked:[],revealed:[]}]})]) assert.throws(()=>parseExamState(raw));
 assert.equal(({} as {polluted?:boolean}).polluted,undefined);assert.equal(saveExamState({setItem:()=>{throw Error('quota');}},emptyExamState()).ok,false);
});

test('unknown exam records and the other language survive a new attempt',()=>{
 const other={...exam,id:'rust:future-exam',language:'rust' as const};
 let state=startExam(emptyExamState(),other,'future-1',now,'rust-old','b'.repeat(64));state=startExam(state,exam,'fixture-1',now,'java-new','a'.repeat(64));
 const roundtrip=parseExamState(JSON.stringify(state));assert.equal(roundtrip.attempts[0].examId,'rust:future-exam');assert.equal(roundtrip.attempts[1].examId,exam.id);
});


test('exam fingerprint changes when question or answer changes but not evidence alone',async()=>{
 const base=await fingerprintExam(exam,questions);assert.match(base,/^[a-f0-9]{64}$/);
 const changed=structuredClone(questions);changed[0].prompt+=' changed';assert.notEqual(await fingerprintExam(exam,changed),base);
 const evidence=structuredClone(questions);evidence[0].evidence.specReviewed=true;assert.equal(await fingerprintExam(exam,evidence),base);
});

import {importExamState} from '../../src/learning-v2/examState';
import {reviewExam} from '../../src/learning-v2/examReview';
import type {Manifest} from '../../src/learning-v2/types';
test('submitted exams expose exact mistakes and unanswered work without grading implementation',()=>{
 let s=startExam(emptyExamState(),exam,'fixture-1',now,'review-1','a'.repeat(64));const m={language:exam.language,chunks:[]} as unknown as Manifest;
 assert.deepEqual(reviewExam(s.attempts[0],exam,questions,m),[]);
 s=updateExam(s,'review-1',a=>({...a,submittedAt:now+1,revealed:[choice.id]}));let rows=reviewExam(s.attempts[0],exam,questions,m);assert.equal(rows[0].status,'unanswered');assert.equal(rows[0].revealed,true);assert.equal(rows[1].status,'ungraded');assert.equal(rows[0].practiceHref,null);
 const answer={...s.attempts[0],selections:{[choice.id]:choice.answer.correctOptionIds}};assert.equal(reviewExam(answer,exam,questions,m)[0].status,'correct');
 assert.equal(reviewExam({...answer,selections:{[choice.id]:['not-an-option']}},exam,questions,m)[0].status,'wrong');
});
test('imported exam histories merge across languages, keep submitted answers and reject identity collisions',()=>{
 const current=startExam(emptyExamState(),exam,'fixture-1',now,'same','a'.repeat(64));
 const submitted=updateExam(current,'same',a=>({...a,submittedAt:now+2,selections:{[choice.id]:choice.answer.correctOptionIds}}));
 const restored=importExamState(JSON.stringify(submitted),current);assert.ok(restored.ok);assert.equal(restored.state.attempts[0].submittedAt,now+2);
 const stale=importExamState(JSON.stringify(current),restored.state);assert.ok(stale.ok);assert.equal(stale.state.attempts[0].submittedAt,now+2);
 const other=startExam(emptyExamState(),{...exam,id:'rust:future-exam',language:'rust'},'future',now,'rust-one','b'.repeat(64));const combined=importExamState(JSON.stringify(other),restored.state);assert.ok(combined.ok);assert.equal(combined.state.attempts.length,2);
 const invalid=structuredClone(current);invalid.attempts[0].examFingerprint='c'.repeat(64);assert.equal(importExamState(JSON.stringify(invalid),submitted).ok,false);assert.equal(submitted.attempts[0].submittedAt,now+2);
 assert.equal(importExamState('{broken',submitted).ok,false);
});
