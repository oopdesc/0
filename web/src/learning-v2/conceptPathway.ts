import {CONCEPTS} from '../academy/content/concepts';
import type {Concept} from '../academy/content/types';
import {applyLegacyConceptCorrections} from './legacyConceptCorrections';
import type {Concept as PackConcept, Lang, Manifest} from './types';
applyLegacyConceptCorrections();
export const PATHWAY_CONCEPTS = CONCEPTS;
export const FAMILY_NAMES:Record<string,string> = {core:'値と制御',oop:'オブジェクトと型',collections:'コレクション',functional:'関数とStream',exceptions:'例外',errors:'例外',ownership:'所有権と借用',data:'データ構造',advanced:'寿命とモジュール',abstraction:'抽象化',interop:'テストとWasm',practical:'HTTPとDB','rust-core':'値と式','rust-ownership':'所有権と借用','rust-data':'データ構造','rust-abstraction':'抽象化','rust-lifetime':'寿命とモジュール','rust-practical':'テストとWasm'};
export function relatedPath(id:string, nodes:readonly Concept[]=PATHWAY_CONCEPTS):Set<string>{
 const result=new Set<string>([id]),byId=new Map(nodes.map(n=>[n.id,n]));
 const visit=(key:string)=>{for(const p of byId.get(key)?.prereqs??[]){if(!result.has(p)&&byId.has(p)){result.add(p);visit(p);}}};visit(id);return result;
}
export function layoutPathway(nodes:readonly Concept[],language:Lang){
 const list=nodes.filter(n=>n.lang===language),byId=new Map(list.map(n=>[n.id,n]));
 const depths=new Map<string,number>(),visiting=new Set<string>();
 const depth=(id:string):number=>{
  if(depths.has(id))return depths.get(id)!;
  if(visiting.has(id))throw Error('概念の学習順序に循環があります。');
  visiting.add(id);const n=byId.get(id);if(!n)throw Error('概念が見つかりません。');
  const parents=n.prereqs.filter(p=>byId.has(p));
  const d=parents.length?Math.max(...parents.map(depth))+1:0;
  visiting.delete(id);depths.set(id,d);return d;
 };
 const columns=new Map<number,Concept[]>();
 for(const n of list){const d=depth(n.id);columns.set(d,[...(columns.get(d)??[]),n]);}
 const positions=new Map<string,{x:number;y:number}>();let rows=1;
 for(const [d,col] of columns){rows=Math.max(rows,col.length);col.forEach((n,i)=>positions.set(n.id,{x:24+d*196,y:48+i*54}));}
 return {positions,width:Math.max(700,columns.size*196+48),height:Math.max(260,rows*54+50),columns:columns.size};
}
export function linkedPackQuestions(node:Concept,concepts:readonly PackConcept[],manifest:Manifest):string[]{
 const indexed=new Set(manifest.chunks.flatMap(c=>c.ids)),ids=new Set<string>();
 for(const c of concepts){
  if(c.language!==node.lang)continue;
  if(c.id===node.id||c.id===`${node.lang}:arena01-${node.id}`||c.name===node.name){
   for(const id of c.problemIds)if(indexed.has(id))ids.add(id);
  }
 }
 return [...ids];
}
