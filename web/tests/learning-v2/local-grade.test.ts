import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localGradeToken, runLocalGrade, sha256, validateLocalResult } from '../../src/learning-v2/localGrade';
import type { Question } from '../../src/learning-v2/types';

const questions = JSON.parse(await readFile(new URL('../../public/learning-v2/java/units/u03.json', import.meta.url), 'utf8')) as Question[];
const q = questions.find(x => x.id === 'java:q0027')!;
const source = q.solution.files[0].content;
const token = 'a'.repeat(64);
async function passed() {
  return {
    status: 'passed', sourceDigest: await sha256(JSON.stringify([{ path: 'Main.java', content: source }])),
    testsDigest: await sha256(JSON.stringify(q.tests[0])),
    cases: q.tests[0].cases.map(c => ({ id: c.id, status: 'passed', actual: { stdout: c.expectedStdout, exitCode: 0 }, expectedComparison: { expected: c.expectedStdout, matched: true } })),
    diagnostics: [], toolchain: { javac: 'javac 17', java: 'openjdk version "17"', target: '--release 17' },
  };
}
const doc = (value: string | null) => ({ querySelector: () => value === null ? null : ({ getAttribute: () => value }) }) as unknown as Pick<Document, 'querySelector'>;
test('local marker is recognized only on the explicit IPv4 loopback origin', () => {
  assert.equal(localGradeToken({ protocol: 'http:', hostname: '127.0.0.1' }, doc(token)), token);
  assert.equal(localGradeToken({ protocol: 'https:', hostname: 'example.com' }, doc(token)), null);
  assert.equal(localGradeToken({ protocol: 'http:', hostname: 'localhost' }, doc(token)), null);
  assert.equal(localGradeToken({ protocol: 'https:', hostname: '127.0.0.1' }, doc(token)), null);
  assert.equal(localGradeToken({ protocol: 'http:', hostname: '127.0.0.1' }, doc(null)), null);
  assert.equal(localGradeToken({ protocol: 'http:', hostname: '127.0.0.1' }, doc('x'.repeat(64))), null);
});
test('a pass is tied to the exact source, fixed test digest and every observed case', async () => {
  const good = await passed(); assert.equal((await validateLocalResult(q, source, good)).status, 'passed');
  await assert.rejects(validateLocalResult(q, source + ' ', good), /コードまたは固定テスト/);
  const altered = structuredClone(q); altered.tests[0].cases[0].expectedStdout = ['different'];
  await assert.rejects(validateLocalResult(altered, source, good), /コードまたは固定テスト/);
  await assert.rejects(validateLocalResult(q, source, { ...good, cases: good.cases.slice(0, -1) }), /全固定テスト/);
  const forged = structuredClone(good); forged.cases[0].actual.stdout = ['forged'];
  await assert.rejects(validateLocalResult(q, source, forged), /全固定テスト/);
  const wrongExit = structuredClone(good); wrongExit.cases[0].actual.exitCode = 1;
  await assert.rejects(validateLocalResult(q, source, wrongExit), /全固定テスト/);
  await assert.rejects(validateLocalResult(q, source, { ...good, status: 'passed', sourceDigest: null }), /照合/);
});
test('unsupported stays ungraded and compilation failures are not passes', async () => {
  const unavailable = { status: 'unsupported', sourceDigest: null, testsDigest: null, cases: [], diagnostics: ['JDK unavailable'], toolchain: null };
  assert.equal((await validateLocalResult(q, source, unavailable)).status, 'unsupported');
  const good = await passed();
  const compile = await validateLocalResult(q, source, { ...good, status: 'compile-error', cases: [], diagnostics: ['invalid Java'] });
  assert.equal(compile.status, 'compile-error'); assert.equal(compile.cases.length, 0);
  await assert.rejects(validateLocalResult(q, source, { ...good, status: 'unknown' }), /形式/);
});
test('explicit grade request uses only a relative same-origin URL and no client-supplied tests', async () => {
  const old = globalThis.fetch; let seen = false;
  globalThis.fetch = async (input, init) => {
    seen = true; assert.equal(input, '/__zero_local/java/grade'); assert.equal(init?.method, 'POST'); assert.equal(init?.credentials, 'same-origin');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['exerciseId', 'files', 'packVersion', 'testSetId']);
    assert.equal(body.exerciseId, q.id); assert.equal(body.testSetId, 'default');
    return new Response(JSON.stringify(await passed()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try { assert.equal((await runLocalGrade(q, '0.1.0', source, token, new AbortController().signal)).status, 'passed'); assert.equal(seen, true); }
  finally { globalThis.fetch = old; }
});
test('Rust request and result bind main.rs and reject a result for Main.java', async () => {
  const rustQuestions=JSON.parse(await readFile(new URL('../../public/learning-v2/rust/beginner.json',import.meta.url),'utf8')) as Question[];
  const rust=rustQuestions.find(q=>q.id==='rust:q0484')!;
  const code=rust.solution.files[0].content;
  const good={status:'passed',sourceDigest:await sha256(JSON.stringify([{path:'main.rs',content:code}])),testsDigest:await sha256(JSON.stringify(rust.tests[0])),cases:rust.tests[0].cases.map(c=>({id:c.id,status:'passed',actual:{stdout:c.expectedStdout,exitCode:0},expectedComparison:{expected:c.expectedStdout,matched:true}})),diagnostics:[],toolchain:{rustc:'rustc fixture'}};
  assert.equal((await validateLocalResult(rust,code,good)).status,'passed');
  await assert.rejects(validateLocalResult(rust,code,{...good,sourceDigest:await sha256(JSON.stringify([{path:'Main.java',content:code}]))}),/コードまたは固定テスト/);
  const old=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{assert.equal(input,'/__zero_local/rust/grade');assert.equal(JSON.parse(String(init?.body)).files[0].path,'main.rs');return new Response(JSON.stringify(good),{status:200});};
  try{assert.equal((await runLocalGrade(rust,'integrated-20261028-2',code,token,new AbortController().signal)).status,'passed');}
  finally{globalThis.fetch=old;}
});
