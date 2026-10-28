import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { makeProjectArchive } from '../../src/learning-v2/projectArchive';
const bundle=JSON.parse(readFileSync(new URL('../../public/learning-v2/java/examples/projects/mission-books-id.json',import.meta.url),'utf8'));

test('project download is a real ZIP of the matching starter and fixed test sources', () => {
 const out=unzipSync(makeProjectArchive(bundle,'java:mission-books-id'));
 assert.ok(strFromU8(out['README-START.md']).includes('展開先のルートで実行'));
 assert.ok(strFromU8(out['backend/java-learning-v2/src/main/java/zero/learning/BookService.java']).includes('UnsupportedOperationException("TODO")'));
 assert.ok(strFromU8(out['backend/java-learning-v2/src/test/java/zero/learning/BookFlowTest.java']).includes('validateIds'));
 assert.ok(Object.keys(out).every(p=>!p.includes('/target/')&&!p.endsWith('.class')));
});
test('project archive refuses traversal, duplicate paths, oversized entries and wrong mission', () => {
 const altered=structuredClone(bundle);altered.files[0].path='../secret.java';assert.throws(()=>makeProjectArchive(altered,bundle.missionId));
 const dup=structuredClone(bundle);dup.files.push(dup.files[0]);assert.throws(()=>makeProjectArchive(dup,bundle.missionId));
 const large=structuredClone(bundle);large.files[0].content='x'.repeat(200_001);assert.throws(()=>makeProjectArchive(large,bundle.missionId));
 assert.throws(()=>makeProjectArchive(bundle,'java:mission-other'));
});
