import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safePackPath, validateManifest, loadChunk, loadConcepts, loadExams, loadExamQuestions, loadProjects, getDiagnostics, loadDiagnosticQuestions } from '../../src/learning-v2/loader';
const read = (name:string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url),'utf8')) as unknown;
const rust=read('rust-manifest.json');

test('Rust fixture satisfies the same manifest contract without claiming a real pack', () => {
 const m=validateManifest(rust,'rust'); assert.equal(m.counts.normal,1); assert.equal(m.contentVersion,'fixture-1');
 assert.equal(safePackPath('units/sample.v1.json'),true);
 for(const bad of ['../x.json','/x.json','https://example/x.json','units/%2e%2e/x.json','units/../x.json','units\\x.json','x.json?query=1']) assert.equal(safePackPath(bad),false,bad);
});

test('duplicate IDs, wrong language, hostile paths and bad totals are rejected', () => {
 const input=rust as Record<string,unknown>;
 for(const change of [
  {...input,language:'java'}, {...input,conceptsPath:'../personal.json'},
  {...input,counts:{normal:999,writing:0,exams:0,projects:0}},
  {...input,chunks:[{path:'a.json',ids:['rust:q0001','rust:q0001']}]},
 ]) assert.throws(()=>validateManifest(change,'rust'));
});

test('fixture chunk is fetched only after manifest and uses the shared question schema', async () => {
 const m=validateManifest(rust,'rust'); const old=globalThis.fetch; const calls:string[]=[];
 globalThis.fetch = (async (url: string | URL | Request) => {
  const value=String(url); calls.push(value);
  const data=value.endsWith('units/sample.v1.json')?read('rust-unit.json'):value.endsWith('concepts.json')?read('rust-concepts.json'):[];
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
 }) as typeof fetch;
 try {
  const qs=await loadChunk(m,m.chunks[0].path);assert.equal(qs[0].id,'rust:q0001');
  assert.equal((await loadConcepts(m))[0].name,'fixture の表示');
  assert.deepEqual(calls,['/learning-v2/rust/units/sample.v1.json','/learning-v2/rust/concepts.json']);
 } finally {globalThis.fetch=old;}
});

test('project loader validates totals, IDs, source paths, extensions and mission fields', async () => {
 const m=validateManifest(JSON.parse(readFileSync(new URL('../../public/learning-v2/java/manifest.json',import.meta.url),'utf8')),'java');
 const original=JSON.parse(readFileSync(new URL('../../public/learning-v2/java/projects.json',import.meta.url),'utf8')) as Record<string,any>[];
 const old=globalThis.fetch; let data:unknown=original;
 globalThis.fetch=(async()=>new Response(JSON.stringify(data),{status:200})) as typeof fetch;
 try {
  const projects=await loadProjects(m); assert.equal(projects.length,3); assert.deepEqual(projects.map(p=>p.missions.length),original.map(p=>p.missions.length)); assert.ok(projects[0].missions.some(task=>task.id==='java:mission-books-create'));
  let copy=structuredClone(original);copy[0].missions[0].files[0].path='../outside.java';data=copy;await assert.rejects(()=>loadProjects(m));
  copy=structuredClone(original);copy[1].id=copy[0].id;data=copy;await assert.rejects(()=>loadProjects(m));
  copy=structuredClone(original);copy[0].extensions.note={not:'text'};data=copy;await assert.rejects(()=>loadProjects(m));
  data=[];await assert.rejects(()=>loadProjects(m));
 } finally {globalThis.fetch=old;}
});


test('exam fixture stays separate from normal questions and checks IDs, order and paths', async () => {
 const raw=JSON.parse(readFileSync(new URL('../../public/learning-v2/java/manifest.json',import.meta.url),'utf8'));raw.counts.exams=1;const manifest=validateManifest(raw,'java');
 const exams=read('exam-fixture.json') as any[];const questions=read('exam-questions-fixture.json') as any[];let data:unknown=exams;const old=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify(data),{status:200})) as typeof fetch;
 try {
  const [exam]=await loadExams(manifest);data=questions;const loaded=await loadExamQuestions(manifest,exam);
  assert.deepEqual(loaded.map(q=>q.id),[...exam.choiceQuestionIds,...exam.codeQuestionIds]);assert.equal(loaded[1].writingRequired,true);
  const bad={...exam,choiceQuestionIds:['java:q0001']};await assert.rejects(()=>loadExamQuestions(manifest,bad));
  await assert.rejects(()=>loadExamQuestions(manifest,{...exam,questionsPath:'../secret.json'}));
  data=[questions[0],questions[0]];await assert.rejects(()=>loadExamQuestions(manifest,exam));
  const flexible={...exam,id:'初級/A',choiceQuestionIds:['choice:一'],codeQuestionIds:['code:一']};
  data=questions.map(q=>({...q,id:q.writingRequired?'code:一':'choice:一'}));assert.equal((await loadExamQuestions(manifest,flexible)).length,2);
 } finally {globalThis.fetch=old;}
});

test('diagnostic reuses indexed normal questions in order without increasing counts',async()=>{
 const raw=JSON.parse(readFileSync(new URL('../../public/learning-v2/java/manifest.json',import.meta.url),'utf8'));const m=validateManifest(raw,'java');
 const [d]=getDiagnostics(m);assert.equal(d.questionIds.length,10);assert.equal(m.counts.normal,m.chunks.flatMap(c=>c.ids).length);
 assert.deepEqual(getDiagnostics(validateManifest(rust,'rust')),[]);
 const bad=structuredClone(raw);bad.extensions.diagnostics[0].questionIds=['java:q0001','java:q0001'];assert.throws(()=>getDiagnostics(validateManifest(bad,'java')));
 const outside=structuredClone(raw);outside.extensions.diagnostics[0].questionIds=['java:q9999'];assert.throws(()=>getDiagnostics(validateManifest(outside,'java')));
 const old=globalThis.fetch; const calls:string[]=[];
 globalThis.fetch=(async (url:string|URL|Request)=>{const name=String(url).split('/').at(-1)!;calls.push(name);const data=JSON.parse(readFileSync(new URL(`../../public/learning-v2/java/units/${name}`,import.meta.url),'utf8'));return new Response(JSON.stringify(data),{status:200});}) as typeof fetch;
 try {
  const questions=await loadDiagnosticQuestions(m,d);assert.deepEqual(questions.map(q=>q.id),d.questionIds);assert.ok(questions.every(q=>q.answer.mode==='choice'&&!q.writingRequired));
  assert.deepEqual(calls,['u01.json','u02.json','u03.json','u04.json']);
  await assert.rejects(()=>loadDiagnosticQuestions(m,{...d,questionIds:['java:q0002']}));
 } finally {globalThis.fetch=old;}
});
