import test from "node:test";
import assert from "node:assert/strict";
import {PROBLEMS,PROBLEM_BY_ID,issuesOfCurriculum} from "../src/academy/content";
test("published archive fixtures agree with expected results and links",()=>{
 assert.deepEqual(issuesOfCurriculum(),[]);assert(PROBLEMS.length>1000);assert.equal(PROBLEM_BY_ID.size,PROBLEMS.length);
 for(const p of PROBLEMS){if(p.runnable===false){assert.equal(p.verified,undefined,p.id);assert.equal(p.expect,undefined,p.id);assert.ok(p.codeNote,p.id);continue;}
 const v=p.verified!;assert(v,p.id);assert(p.expect,p.id);
 if(p.expect!.kind==="output"){assert.equal(v.verdict,"ok",p.id);assert.deepEqual(v.stdout,p.expect!.output,p.id);}
 if(p.expect!.kind==="compile-ok-no-run"){assert.equal(v.verdict,"ok",p.id);assert.equal(v.scope,"compile-only",p.id);}
 if(p.expect!.kind==="compile-error")assert.equal(v.verdict,"compile-error",p.id);
 if(p.expect!.kind==="runtime-error"){assert.equal(v.verdict,"runtime-error",p.id);assert.equal(v.exception??v.errorCode,p.expect!.exception,p.id);}
 assert.notEqual(p.answer.mode,"code",p.id);
 }
});

import { supplementalPath } from '../src/academy/lib/router';
test('supplemental deep links survive valid encoding and malformed hashes cannot crash the page',()=>{
 assert.equal(supplementalPath('#/p/j-core-01'),'/p/j-core-01');
 assert.equal(supplementalPath('#/learn/rust/r-ownership/'),'/learn/rust/r-ownership');
 assert.equal(supplementalPath('#/p/%E0%A4'),'/browse');
 assert.equal(supplementalPath('#main'),'/');
 assert.equal(supplementalPath(''),'/');
});

test('supplemental fixes distinguish constant overflow, JavaScript, and compiler diagnostics',()=>{
 const over=PROBLEM_BY_ID.get('r-w-113')!;assert.ok(over.code!.includes('fn increment'));assert.equal(over.verified?.scope,'compile-only');assert.ok(over.explanation.includes('定数'));
 for(const id of ['r-e-111','r-w-114','r-w-118']){assert.equal(PROBLEM_BY_ID.get(id)?.runnable,false);assert.equal(PROBLEM_BY_ID.get(id)?.verified,undefined);}
 assert.equal(PROBLEM_BY_ID.get('r-e-112')?.verified?.verdict,'runtime-error');
 assert.ok(PROBLEM_BY_ID.get('r-w-118')?.explanation.includes('再割当て'));
});

import {actualText} from '../src/academy/components/DiffView';
test('concept questions compare the selected answer with the explanation, never a fake execution result',()=>{
 const p=PROBLEM_BY_ID.get('r-w-118')!;assert.equal(p.answer.mode,'choice');if(p.answer.mode==='choice')assert.deepEqual(actualText(p),[p.answer.options[p.answer.correct].text]);
});
