import test from "node:test";
import assert from "node:assert/strict";
import {PROBLEMS,PROBLEM_BY_ID,issuesOfCurriculum} from "../src/academy/content";
test("published archive fixtures agree with expected results and links",()=>{
 assert.deepEqual(issuesOfCurriculum(),[]);assert(PROBLEMS.length>1000);assert.equal(PROBLEM_BY_ID.size,PROBLEMS.length);
 for(const p of PROBLEMS){const v=p.verified!;assert(v,p.id);assert(p.expect,p.id);
 if(p.expect!.kind==="output"){assert.equal(v.verdict,"ok",p.id);assert.deepEqual(v.stdout,p.expect!.output,p.id);}
 if(p.expect!.kind==="compile-error")assert.equal(v.verdict,"compile-error",p.id);
 if(p.expect!.kind==="runtime-error"){assert.equal(v.verdict,"runtime-error",p.id);assert.equal(v.exception??v.errorCode,p.expect!.exception,p.id);}
 assert.notEqual(p.answer.mode,"code",p.id);
 }
});
