/** Explicit local Rust runner. Fixed server-side tests; never a public sandbox. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const lines=s=>{const n=s.replace(/\r\n?/g,'\n');return n===''?[]:(n.endsWith('\n')?n.slice(0,-1):n).split('\n');};
const safePath=x=>typeof x==='string'&&/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(x);
function run(bin,args,{cwd,input='',timeout=8000,compile=false}={}){
 return new Promise(resolve=>{
  let out='',err='',done=false,timedOut=false,overflow=false;
  const env={PATH:'/opt/homebrew/bin:/usr/bin:/bin',HOME:compile?os.homedir():cwd,TMPDIR:cwd,LANG:'en_US.UTF-8'};
  const child=spawn(bin,args,{cwd,env,shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
  const kill=()=>{try{process.platform!=='win32'?process.kill(-child.pid,'SIGKILL'):child.kill('SIGKILL');}catch{}};
  const finish=(code,error)=>{if(done)return;done=true;clearTimeout(timer);kill();resolve({code,out,err,error,timedOut,overflow});};
  const timer=setTimeout(()=>{timedOut=true;kill();},timeout);
  const collect=(which,data)=>{if(which==='out')out+=data;else err+=data;if(Buffer.byteLength(out)+Buffer.byteLength(err)>65536){overflow=true;out=out.slice(0,32768);err=err.slice(0,32768);kill();}};
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',d=>collect('out',d));child.stderr.on('data',d=>collect('err',d));
  child.on('error',e=>finish(null,e.code||'spawn failed'));child.on('close',code=>finish(code,null));
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
const compiler=context=>context?.toolchains?.rust?.rustc||path.join(os.homedir(),'.cargo/bin/rustc');
export async function capabilities(context={}){
 const r=await run(compiler(context),['--version'],{cwd:context.workDir||os.tmpdir(),timeout:3000,compile:true});
 return {language:'rust',available:r.code===0,profiles:['rust2021-fixed-v1'],toolchain:{rustc:(r.out+r.err).trim(),target:'edition 2021'}};
}
async function question(root,id,version){
 if(!/^rust:q[0-9]{4,}$/.test(id))throw Error('invalid exercise ID');
 const dir=await fs.realpath(path.join(root,'web/public/learning-v2/rust'));
 const read=async rel=>{
  if(!safePath(rel))throw Error('unsafe pack path');
  const p=path.join(dir,rel),real=await fs.realpath(p),st=await fs.lstat(p);
  if(!real.startsWith(dir+path.sep)||!st.isFile()||st.isSymbolicLink()||st.size>2000000)throw Error('invalid pack file');
  return JSON.parse(await fs.readFile(real,'utf8'));
 };
 const manifest=await read('manifest.json');
 if(manifest.language!=='rust'||manifest.contentVersion!==version)throw Error('pack version mismatch');
 const chunks=manifest.chunks.filter(c=>c.ids.includes(id));if(chunks.length!==1)throw Error('exercise missing or ambiguous');
 const qs=await read(chunks[0].path),found=qs.filter(q=>q.id===id);if(found.length!==1)throw Error('exercise missing');return found[0];
}
export async function grade(request,context={}){
 const result={runId:randomUUID(),sourceDigest:null,testsDigest:null,toolchain:null,status:'not-run',cases:[],diagnostics:[]};
 let work;
 try{
  if(!context.repoRoot||!context.workDir||request?.files?.length!==1||request.files[0]?.path!=='main.rs'||typeof request.files[0]?.content!=='string')throw Error('expected one editable main.rs');
  const source=request.files[0].content;if(Buffer.byteLength(source)>65536)throw Error('source limit');
  result.sourceDigest=hash(JSON.stringify([{path:'main.rs',content:source}]));
  const q=await question(context.repoRoot,request.exerciseId,request.packVersion);
  if(!q.writingRequired||q.runnerProfile!=='rust2021-fixed-v1'||request.testSetId!=='default')throw Error('no verified Rust test contract');
  const tests=q.tests.filter(t=>t.id==='default');if(tests.length!==1)throw Error('test set missing');
  const t=tests[0];
  if(t.mode!=='harness'||t.testFiles.length!==1||t.testFiles[0].path!=='Harness.rs'||t.testFiles[0].editable!==false||typeof t.testFiles[0].content!=='string'||Buffer.byteLength(t.testFiles[0].content)>65536||!t.cases.length||t.cases.length>32||t.cases.some(c=>c.expectedCompile!=='pass'||c.expectedExit!==0||typeof c.stdin!=='string'||!Array.isArray(c.expectedStdout)))throw Error('invalid fixed test contract');
  result.testsDigest=hash(JSON.stringify(t));
  const caps=await capabilities(context);result.toolchain=caps.toolchain;if(!caps.available){result.status='unsupported';return result;}
  work=await fs.mkdtemp(path.join(await fs.realpath(context.workDir),'zero-rust-'));
  await fs.writeFile(path.join(work,'main.rs'),source+'\n'+t.testFiles[0].content,'utf8');
  const binary=path.join(work,'exercise');
  const compile=await run(compiler(context),['--edition=2021','-C','codegen-units=1','-Awarnings','main.rs','-o',binary],{cwd:work,compile:true});
  if(compile.timedOut||compile.overflow){result.status='timeout';return result;}
  if(compile.error){result.status='unsupported';result.diagnostics.push(compile.error);return result;}
  if(compile.code!==0){result.status='compile-error';result.diagnostics.push(compile.err.slice(0,8192));return result;}
  for(const c of t.cases){
   const r=await run(binary,[],{cwd:work,input:c.stdin,timeout:3000}),stdout=lines(r.out);
   const equal=JSON.stringify(stdout)===JSON.stringify(c.expectedStdout);
   const status=r.timedOut||r.overflow?'timeout':r.error?'unsupported':r.code!==0?'runtime-error':equal?'passed':'failed';
   result.cases.push({id:c.id,status,actual:{stdout,exitCode:r.code},expectedComparison:{expected:c.expectedStdout,matched:equal&&r.code===0}});
   if(r.err)result.diagnostics.push(r.err.slice(0,2000));
   if(status==='timeout'||status==='unsupported')break;
  }
  const states=result.cases.map(c=>c.status);result.status=states.includes('timeout')?'timeout':states.includes('unsupported')?'unsupported':states.includes('runtime-error')?'runtime-error':states.includes('failed')?'failed':states.length===t.cases.length?'passed':'not-run';
 }catch(e){result.status='unsupported';result.diagnostics.push(e instanceof Error?e.message:'invalid request');}
 finally{if(work)await fs.rm(work,{recursive:true,force:true});}
 return result;
}
