import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateManifest,loadChunk} from '../../src/learning-v2/loader';
import type {Concept,Question} from '../../src/learning-v2/types';
const read=(path:URL)=>JSON.parse(readFileSync(path,'utf8'));
test('every published chunk agrees with its index, counts and concept links',async(t)=>{
 t.mock.method(globalThis,'fetch',async(input:unknown)=>{const url=String(input);assert.match(url,/^\/learning-v2\/(java|rust)\/[A-Za-z0-9._/-]+\.json$/);return new Response(readFileSync(new URL('../../public'+url,import.meta.url),'utf8'));});
 for(const lang of ['java','rust'] as const){
  const dir=new URL(`../../public/learning-v2/${lang}/`,import.meta.url),m=validateManifest(read(new URL('manifest.json',dir)),lang);
  const all:Question[]=[];for(const c of m.chunks)all.push(...await loadChunk(m,c.path));
  const ids=new Set(all.map(q=>q.id)),concepts=read(new URL(m.conceptsPath,dir)) as Concept[],conceptIds=new Set(concepts.map(c=>c.id));
  assert.equal(ids.size,all.length);assert.equal(all.length,m.counts.normal);assert.equal(all.filter(q=>q.writingRequired).length,m.counts.writing);
  for(const q of all){for(const c of [...q.conceptIds,...q.prerequisiteConceptIds])assert(conceptIds.has(c),`${q.id}: ${c}`);for(const id of [...q.relatedIds,...q.transferIds])assert(ids.has(id),`${q.id}: ${id}`);}
  for(const c of concepts){for(const id of [...c.problemIds,...c.introducedBy])assert(ids.has(id),`${c.id}: ${id}`);for(const id of c.hardPrerequisiteIds)assert(conceptIds.has(id),`${c.id}: ${id}`);}
 }
});
test('repaired writing tasks retain distinct IDs and compiler evidence tied to their exact reference',()=>{
 for(const [lang,file] of [['java','boundary-writing.json'],['rust','foundation-writing.json']]){
  const qs=read(new URL(`../../public/learning-v2/${lang}/${file}`,import.meta.url)) as Question[];
  assert.equal(qs.length,40);assert.equal(new Set(qs.map(q=>q.extensions?.sourceId)).size,qs.length);
  for(const q of qs){
   assert(q.writingRequired);assert(q.tests[0].cases.length>=2);assert(q.solution.reasoningSteps.length>=3);
   const source=q.solution.files[0].content,e=q.evidence.compilerRun!;assert(e,q.id);assert.equal(e.status,'passed');
   assert.equal(e.sourceSha256,createHash('sha256').update(source).digest('hex'),q.id);
   assert(q.tests[0].testFiles[0].editable===false);assert(q.tests[0].cases.every(c=>c.expectedCompile==='pass'&&c.expectedExit===0));
  }
 }
});
