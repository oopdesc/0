import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, exportProgress, importProgress, loadProgress, markExposure, mergeProgress, projectDraftKey, recordKey, recordPrediction, recordRecall, saveDraft, saveProgress, STORAGE_KEY } from '../../src/learning-v2/progress';
const now = Date.now();
const k = recordKey('java:q0001','1.0.0','prediction');
const rust = recordKey('rust:q0001','1.0.0','code');

test('blind, assisted, and later recall are separate; content versions do not share mastery', () => {
 let s = recordPrediction(emptyProgress(), k, true, now - 2 * 86_400_000);
 assert.equal(s.records[k].blindCorrect, 1); assert.equal(s.records[k].assistedCorrect, 0);
 s = recordRecall(s, k, now); assert.equal(s.records[k].recalls, 1);
 const again = recordRecall(s, k, now + 1000); assert.equal(again, s);
 const second = recordKey('java:q0001','2.0.0','prediction');
 s = markExposure(s, second, 'hint', now);
 s = recordPrediction(s, second, true, now + 1);
 assert.equal(s.records[second].assistedCorrect, 1); assert.equal(s.records[second].blindCorrect, 0);
 assert.equal(s.records[k].blindCorrect, 1);
});

test('size, schema, dates, scores and prototype keys are rejected without changing existing state', () => {
 const current = saveDraft(emptyProgress(), rust, 'new code', now);
 const before = exportProgress(current);
 for (const input of [
  'x'.repeat(1_048_577),
  '{"schema":"zero-learning-progress/1","records":{},"drafts":{},"legacy":{"__proto__":{"polluted":true}}}',
  '{"schema":"zero-learning-progress/999","records":{},"drafts":{},"legacy":{}}',
  JSON.stringify({schema:'zero-learning-progress/1',records:{[k]:{updatedAt:now,blindCorrect:-1,assistedCorrect:0,wrong:0,lastAttemptAt:null,hintsAt:null,solutionAt:null,recalls:0,reviewStep:0,dueAt:null}},drafts:{},legacy:{}}),
  JSON.stringify({schema:'zero-learning-progress/1',records:{},drafts:{[rust]:{content:'old',updatedAt:now + 10 * 86_400_000}},legacy:{}}),
 ]) { const result=importProgress(input,current); assert.equal(result.ok,false); assert.equal(exportProgress(current),before); }
 assert.equal(({} as {polluted?: boolean}).polluted, undefined);
});

test('old imports do not overwrite newer drafts or other language records; unknown IDs survive', () => {
 let current=saveDraft(emptyProgress(),rust,'new Rust draft',now);
 current=recordPrediction(current,k,true,now);
 const older=saveDraft(emptyProgress(),rust,'older draft',now-1000);
 const imported=importProgress(exportProgress(older),current); assert.ok(imported.ok);
 assert.equal(imported.state.drafts[rust].content,'new Rust draft');
 assert.equal(imported.state.records[k].blindCorrect,1);
 const aliases=[{source:'academy' as const,id:'j-core-01',targetId:'java:q0017'}];
 const old=JSON.stringify({v:1,attempts:[{pid:'j-core-01',at:now-1000,ok:true},{pid:'unknown-old-id',at:now-500,ok:false}]});
 const migrated=importProgress(old,imported.state,aliases); assert.ok(migrated.ok && migrated.legacyOnly);
 assert.equal(migrated.state.legacy['academy:j-core-01'].targetId,'java:q0017');
 assert.equal(migrated.state.legacy['academy:unknown-old-id'].targetId,null);
 assert.equal(migrated.state.records[k].blindCorrect,1);
 assert.equal(migrated.state.drafts[rust].content,'new Rust draft');
 const again=importProgress(old,migrated.state,aliases); assert.ok(again.ok); assert.deepEqual(again.state,migrated.state);
});

test('save failure and corrupt existing local data do not delete or replace it', () => {
 const stored = new Map([[STORAGE_KEY,'{broken']]);
 const badRead=loadProgress({getItem:key=>stored.get(key)??null});
 assert.equal(badRead.writable,false); assert.equal(stored.get(STORAGE_KEY),'{broken');
 const failing={setItem:()=>{throw new Error('quota');}};
 assert.equal(saveProgress(failing,emptyProgress()).ok,false);
 assert.equal(stored.get(STORAGE_KEY),'{broken');
});


test('project drafts roundtrip separately, preserve other languages and reject older imports', () => {
 const project=projectDraftKey('java:mission-books-id','1.0.0',0);
 let state=saveDraft(emptyProgress(),rust,'Rust draft',now);
 state=saveDraft(state,project,'Java project draft',now);
 const older=saveDraft(emptyProgress(),project,'old project',now-5000);
 const merged=importProgress(exportProgress(older),state); assert.ok(merged.ok);
 assert.equal(merged.state.drafts[project].content,'Java project draft');
 assert.equal(merged.state.drafts[rust].content,'Rust draft');
 const oversized=saveDraft(state,project,'あ'.repeat(30000),now); assert.equal(oversized,state);
 assert.ok(importProgress(exportProgress(state),emptyProgress()).ok);
});

test('merging live and stale state retains later other-language records and drafts', () => {
 const old=saveDraft(recordPrediction(emptyProgress(),k,true,now-100),rust,'old draft',now-100);
 let live=saveDraft(old,rust,'new Rust draft',now);
 const rustRecord=recordKey('rust:q0001','1.0.0','prediction');
 live=recordPrediction(live,rustRecord,false,now);
 const combined=mergeProgress(live,old);
 assert.equal(combined.drafts[rust].content,'new Rust draft');assert.equal(combined.records[rustRecord].wrong,1);assert.equal(combined.records[k].blindCorrect,1);
});
