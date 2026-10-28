/** Explicit, local-only adapter coordinator. Nothing here starts a server. */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
let active=0;const waiters=[];
async function lock(){if(active<2){active++;return;}await new Promise(resolve=>waiters.push(resolve));}
function unlock(){if(waiters.length)waiters.shift()();else active--;}
async function adapter(language,context){
 if(!['java','rust'].includes(language)||!context?.repoRoot)return null;
 const file=path.join(context.repoRoot,'contributions',language,'runner.mjs');
 try{await access(file);const m=await import(pathToFileURL(file).href);return typeof m.grade==='function'&&typeof m.capabilities==='function'?m:null;}catch{return null;}
}
export async function capabilities(context){
 const result={};
 for(const lang of ['java','rust']){const a=await adapter(lang,context);result[lang]=a?await a.capabilities(context):{language:lang,available:false,status:'unsupported',note:'adapter not installed'};}
 return result;
}
export async function grade(request,context){
 await lock();
 try{
  const inferred=/^(java|rust):/.exec(request?.exerciseId || '')?.[1];
  const chosen=context?.language;
  if(chosen && (!['java','rust'].includes(chosen) || (inferred && inferred!==chosen))) return {runId:randomUUID(),sourceDigest:null,testsDigest:null,toolchain:null,status:'unsupported',cases:[],diagnostics:['Language does not match the trusted selection.']};
  const lang=chosen || inferred;
  const a=lang?await adapter(lang,context):null;
  if(!a)return {runId:randomUUID(),sourceDigest:null,testsDigest:null,toolchain:null,status:'unsupported',cases:[],diagnostics:['No adapter for this language.']};
  return await a.grade(request,context);
 }finally{unlock();}
}
