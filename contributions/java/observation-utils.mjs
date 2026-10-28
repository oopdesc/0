// Helpers for compiler-run observations. Expected failures do not waive stdout checks.
import {createHash} from 'node:crypto';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
// Bump when the executable/decoding policy changes; old results must be rerun.
export const EXECUTION_PROFILE='java-release17-utf8-stream-v2';
// This binds *execution evidence* to the ID, source hash (checked separately), and
// fixed execution contract. It is not a hash of semantic review or browser state.
export function verificationContractDigest(q) {
  const ext=q.extensions || {};
  return sha256(JSON.stringify({executionProfile:EXECUTION_PROFILE,id:q.id,writingRequired:!!q.writingRequired,runnerProfile:q.runnerProfile??null,
    tests:q.tests??[],expectedCompile:ext.expectedCompile??'pass',
    expectedRuntimeError:ext.expectedRuntimeError??null,expectedObservation:ext.expectedObservation??null}));
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reusableObservation(q,o,d,{toolchain,runtime}={}) {
  if(!q||!o||!d||q.id!==d.id||o.status!==d.status||!same(o.stdout,d.observed)) return false;
  const src=(q.writingRequired?q.solution?.files:q.setup?.files)?.[0]?.content;
  if(typeof src!=='string'||o.sourceSha256!==sha256(src))return false;
  const contract=verificationContractDigest(q);
  // Unversioned/older execution profiles cannot be carried into the UTF-8 policy.
  if(o.contractSha256!==contract) return false;
  if(o.toolchainVersion!==toolchain||o.runtimeVersion!==runtime)return false;
  const ext=q.extensions||{};
  if(q.writingRequired){
    const t=q.tests?.find(t=>t.id==='default');
    if(!t || d.sourceDigest!==sha256(JSON.stringify([{path:'Main.java',content:src}])) || d.testsDigest!==sha256(JSON.stringify(t)) || d.status!=='passed' || !Array.isArray(d.cases) || d.cases.length!==t.cases.length)return false;
    return d.cases.every((c,i)=>c.id===t.cases[i].id && c.status==='passed' && c.actual?.exitCode===0 && c.expectedComparison?.matched===true && same(c.actual.stdout,t.cases[i].expectedStdout) && same(c.expectedComparison.expected,t.cases[i].expectedStdout));
  }
  if(ext.expectedCompile==='fail')return d.status==='expected-compile-error'&&Number.isInteger(d.compileExit)&&d.compileExit!==0;
  if(ext.expectedRuntimeError)return d.status==='expected-runtime-error'&&Number.isInteger(d.exit)&&d.exit!==0&&typeof d.stderr==='string'&&d.stderr.includes(ext.expectedRuntimeError)&&same(d.observed,ext.expectedObservation);
  return d.status==='passed'&&d.exit===0&&d.matchesExpected===true&&same(d.observed,ext.expectedObservation);
}
export function observationLines(stdout) {
  let value=stdout.replace(/\r\n?/g,'\n');
  if(value==='') return [];
  if(value.endsWith('\n')) value=value.slice(0,-1);
  return value.split('\n');
}
export function matchesExpectedRuntimeFailure(result, exceptionName, expectedStdout) {
  if(result.ok || !Number.isInteger(result.code) || result.code===0 || typeof exceptionName!=='string' || !exceptionName || !Array.isArray(expectedStdout)) return false;
  if(typeof result.stderr!=='string' || !result.stderr.includes(exceptionName) || typeof result.stdout!=='string') return false;
  return JSON.stringify(observationLines(result.stdout))===JSON.stringify(expectedStdout);
}
