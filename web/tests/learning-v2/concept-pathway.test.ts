import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PATHWAY_CONCEPTS,layoutPathway,linkedPackQuestions,relatedPath} from '../../src/learning-v2/conceptPathway';
import type {Concept as PackConcept,Manifest} from '../../src/learning-v2/types';

test('recovered pathway is acyclic and each prerequisite is present in its language',()=>{
 const ids=new Set(PATHWAY_CONCEPTS.map(n=>n.id));assert.equal(ids.size,PATHWAY_CONCEPTS.length);
 for(const lang of ['java','rust'] as const){
  const nodes=PATHWAY_CONCEPTS.filter(n=>n.lang===lang),layout=layoutPathway(nodes,lang);
  for(const n of nodes){const b=layout.positions.get(n.id)!;assert(b);
   for(const p of n.prereqs){const parent=nodes.find(n=>n.id===p);assert(parent,`${n.id}: ${p}`);const a=layout.positions.get(p)!;assert(a.x<b.x,`${p} must precede ${n.id}`);}
  }
 }
 const n=structuredClone(PATHWAY_CONCEPTS[0]);n.prereqs=[n.id];assert.throws(()=>layoutPathway([n],n.lang),/循環/);
});
test('selected pathway includes all ancestors, but not unrelated branches',()=>{
 const n=PATHWAY_CONCEPTS.find(n=>n.id==='r-lifetime')!;const ids=relatedPath(n.id);
 assert(ids.has(n.id));for(const id of ids){for(const p of PATHWAY_CONCEPTS.find(n=>n.id===id)!.prereqs)assert(ids.has(p));}
 assert(!ids.has('j-primitive'));
});
test('links from recovered concepts always target real indexed questions',()=>{
 for(const lang of ['java','rust'] as const){
  const dir=new URL(`../../public/learning-v2/${lang}/`,import.meta.url);
  const m=JSON.parse(readFileSync(new URL('manifest.json',dir),'utf8')) as Manifest;
  const cs=JSON.parse(readFileSync(new URL('concepts.json',dir),'utf8')) as PackConcept[];
  const ids=new Set(m.chunks.flatMap(c=>c.ids));let links=0;
  for(const n of PATHWAY_CONCEPTS.filter(n=>n.lang===lang)){const found=linkedPackQuestions(n,cs,m);links+=found.length;assert.equal(new Set(found).size,found.length);for(const id of found)assert(ids.has(id));}
  assert(links>0,`${lang} needs real problem links`);
  const bogus={...cs[0],id:PATHWAY_CONCEPTS.find(n=>n.lang===lang)!.id,problemIds:['not-published']};assert.deepEqual(linkedPackQuestions(PATHWAY_CONCEPTS.find(n=>n.lang===lang)!,[bogus],m),[]);
 }
});
