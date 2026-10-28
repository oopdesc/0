/** Local-only Java adapter. No HTTP endpoint, no shell, and no client-supplied tests.
 * The working directory and limits are NOT an OS security sandbox. Run only your
 * own code on a machine without sensitive data or privileged credentials. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const MAX_SOURCE = 65536, MAX_OUTPUT = 65536, MAX_CASES = 32;
const digest = value => createHash('sha256').update(value).digest('hex');
const lines = s => {
  let t = s.replace(/\r\n?/g, '\n');
  if (!t) return [];
  if (t.endsWith('\n')) t = t.slice(0,-1);
  return t.split('\n');
};
const safeRelative = s => typeof s === 'string' && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(s);
const duration = start => Math.round(performance.now()-start);
let active=0; const waiters=[];
async function lock() { if(active < 2) { active++; return; } await new Promise(resolve=>waiters.push(resolve)); }
function unlock(){ if(waiters.length) waiters.shift()(); else active--; }
function boundedInt(x, fallback, min, max) {return Number.isInteger(x) ? Math.max(min,Math.min(max,x)) : fallback;}
function runProcess(bin,args,{cwd,stdin='',timeoutMs=5000,env={}}={}) {
 return new Promise(resolve=>{
  const start=performance.now(); let out='',err='',timedOut=false,overflow=false,spawnError=null, settled=false;
  let child;
  const done=(code,signal)=>{ if(settled)return; settled=true; clearTimeout(timer);
   // Detached child process group is killed on both timeout and normal exit to
   // avoid leaving ordinary descendants behind; this is not an OS sandbox.
   if(child?.pid && process.platform!=='win32') try { process.kill(-child.pid,'SIGKILL'); } catch {}
   resolve({code,signal,stdout:out,stderr:err,timedOut,overflow,spawnError,duration:duration(start)});
  };
  try { child=spawn(bin,args,{cwd,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:cwd || '/tmp',TMPDIR:cwd || '/tmp',...env},shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']}); }
  catch(e){ resolve({code:null,signal:null,stdout:'',stderr:'',timedOut:false,overflow:false,spawnError:String(e),duration:duration(start)}); return; }
  const kill=()=>{ try { if(process.platform!=='win32' && child.pid) process.kill(-child.pid,'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
  const timer=setTimeout(()=>{timedOut=true;kill();},timeoutMs);
  const append=(which,data)=>{ const text=data.toString('utf8'); if(which==='out') out+=text; else err+=text;
   if(Buffer.byteLength(out)+Buffer.byteLength(err)>MAX_OUTPUT){overflow=true;out=out.slice(0,MAX_OUTPUT);err=err.slice(0,MAX_OUTPUT);kill();} };
  // Node's streaming UTF-8 decoder preserves multibyte characters split across
  // data events; decoding each Buffer independently can corrupt exact output.
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data',d=>append('out',d)); child.stderr.on('data',d=>append('err',d));
  child.on('error',e=>{spawnError=e.code || String(e);done(null,null);});
  child.on('close',(code,signal)=>done(code,signal));
  child.stdin.on('error',()=>{}); child.stdin.end(stdin);
 });
}
function bins(context){return {javac:context?.toolchains?.java?.javac || 'javac',java:context?.toolchains?.java?.java || 'java'};}
export async function capabilities(context={}) {
 const b=bins(context), cwd=context.workDir || '/tmp';
 const [c,j]=await Promise.all([runProcess(b.javac,['-version'],{cwd,timeoutMs:3000}),runProcess(b.java,['-version'],{cwd,timeoutMs:3000})]);
 const javacVersion=(c.stdout+c.stderr).trim();
 const major=Number(/javac\s+(\d+)/.exec(javacVersion)?.[1] || 0);
 return {language:'java',available:c.code===0&&j.code===0&&major>=17,profiles:['java17-stdio-v1','java17-harness-v1'],
   toolchain:{javac:javacVersion,java:(j.stdout+j.stderr).trim(),target:'--release 17'},
   note:'本人のコードのみ。HTTP公開・OSレベル隔離・全Java仕様の証明ではありません。'};
}
async function readPackQuestion(root,exerciseId,packVersion){
 if(typeof exerciseId!=='string'||exerciseId.length<1||exerciseId.length>200||/[\u0000-\u001f\u007f]/u.test(exerciseId)||['__proto__','prototype','constructor'].includes(exerciseId)) throw new Error('invalid exerciseId');
 const dir=path.join(root,'web/public/learning-v2/java');
 const realDir=await fs.realpath(dir);
 const read=async rel=>{
  if(!safeRelative(rel)) throw new Error('unsafe pack path');
  const p=path.join(realDir,rel), real=await fs.realpath(p);
  if(!real.startsWith(realDir+path.sep)) throw new Error('pack path escapes root');
  const st=await fs.lstat(p); if(!st.isFile()||st.isSymbolicLink()||st.size>2_000_000) throw new Error('invalid pack file');
  return JSON.parse(await fs.readFile(real,'utf8'));
 };
 const m=await read('manifest.json');
 if(m.schema!=='zero-learning-pack/1'||m.language!=='java'||m.contentVersion!==packVersion) throw new Error('pack version mismatch');
 if(!Array.isArray(m.chunks)) throw new Error('invalid manifest chunks');
 const normal=m.chunks.filter(c=>Array.isArray(c.ids)&&c.ids.includes(exerciseId)).map(c=>c.path);
 const exams=await read(m.examsPath);
 if(!Array.isArray(exams)||exams.length!==m.counts?.exams) throw new Error('invalid exam index');
 const examPaths=exams.filter(e=>e?.language==='java'&&Array.isArray(e.codeQuestionIds)&&e.codeQuestionIds.includes(exerciseId)).map(e=>e.questionsPath);
 const paths=[...normal,...examPaths];
 if(paths.length!==1) throw new Error('exercise missing or ambiguous');
 const questions=await read(paths[0]);
 if(!Array.isArray(questions))throw new Error('invalid chunk');
 const found=questions.filter(q=>q.id===exerciseId&&q.language==='java');
 if(found.length!==1)throw new Error('question missing or ambiguous');
 return found[0];
}
export async function grade(request,context={}) {
 const runId=randomUUID(); const base={runId,sourceDigest:null,testsDigest:null,toolchain:null,status:'not-run',cases:[],diagnostics:[]};
 await lock(); let runDir;
 try {
  if(!context.repoRoot||!context.workDir) throw new Error('trusted repoRoot/workDir required');
  if(!request || !Array.isArray(request.files) || request.files.length!==1 || request.files[0]?.path!=='Main.java' || typeof request.files[0]?.content!=='string') throw new Error('expected exactly one editable Main.java');
  const code=request.files[0].content;
  if(Buffer.byteLength(code,'utf8')>MAX_SOURCE)throw new Error('source exceeds 65536 bytes');
  base.sourceDigest=digest(JSON.stringify([{path:'Main.java',content:code}]));
  const q=await readPackQuestion(context.repoRoot,request.exerciseId,request.packVersion);
  if(!q.writingRequired || !['java17-harness-v1','java17-stdio-v1'].includes(q.runnerProfile)) throw new Error('no supported writing test profile');
  const sets=q.tests.filter(t=>t.id===request.testSetId);
  if(sets.length!==1)throw new Error('unknown or ambiguous test set');
  const t=sets[0];
  if(!Array.isArray(t.cases)||t.cases.length===0||t.cases.length>MAX_CASES||!Array.isArray(t.testFiles))throw new Error('invalid test set');
  if(t.cases.some(c=>c.expectedCompile!=='pass'||c.expectedExit!==0||!Array.isArray(c.expectedStdout)||typeof c.stdin!=='string'))throw new Error('unsupported case contract');
  if(t.testFiles.some(f=>f.path!=='Harness.java'||f.editable!==false||typeof f.content!=='string'||Buffer.byteLength(f.content)>MAX_SOURCE)||t.testFiles.length>1)throw new Error('unsupported test file');
  if(!['harness','stdio'].includes(t.mode)||(t.mode==='harness')!==(t.testFiles.length===1))throw new Error('test mode mismatch');
  base.testsDigest=digest(JSON.stringify(t));
  const caps=await capabilities(context);base.toolchain=caps.toolchain;
  if(!caps.available){base.status='unsupported';base.diagnostics.push('JDK javac/java unavailable');return base;}
  const parent=await fs.realpath(context.workDir);
  runDir=await fs.mkdtemp(path.join(parent,'zero-java-'));
  await fs.mkdir(path.join(runDir,'classes'));
  await fs.writeFile(path.join(runDir,'Main.java'),code,'utf8');
  if(t.testFiles.length) await fs.writeFile(path.join(runDir,'Harness.java'),t.testFiles[0].content,'utf8');
  const b=bins(context), time=boundedInt(context.limits?.timeoutMs,5000,500,10000);
  const compile=await runProcess(b.javac,['-J-XX:ActiveProcessorCount=2','-J-Xmx256m','--release','17','-encoding','UTF-8','-d','classes','Main.java',...(t.testFiles.length?['Harness.java']:[])],{cwd:runDir,timeoutMs:time});
  if(compile.timedOut||compile.overflow){base.status='timeout';base.diagnostics.push(compile.overflow?'コンパイラ出力上限':'コンパイル時間上限');return base;}
  if(compile.spawnError){base.status='unsupported';base.diagnostics.push(String(compile.spawnError));return base;}
  if(compile.code!==0){base.status='compile-error';base.diagnostics.push(compile.stderr.slice(0,8192));return base;}
  for(const c of t.cases){
   const result=await runProcess(b.java,['-Xmx64m','-XX:ActiveProcessorCount=1','-Dfile.encoding=UTF-8','-cp','classes',t.mode==='harness'?'Harness':'Main'],{cwd:runDir,stdin:c.stdin,timeoutMs:time});
   const actual=lines(result.stdout); const equal=actual.length===c.expectedStdout.length&&actual.every((s,i)=>s===c.expectedStdout[i]);
   const status=result.timedOut||result.overflow?'timeout':result.spawnError?'unsupported':result.code!==0?'runtime-error':equal?'passed':'failed';
   base.cases.push({id:c.id,status,actual:{stdout:actual,exitCode:result.code},expectedComparison:{mode:'exact-lines',expected:c.expectedStdout,matched:equal&&result.code===0},duration:result.duration});
   if(result.stderr)base.diagnostics.push(`${c.id}: ${result.stderr.slice(0,2000)}`);
   if(status==='timeout'||status==='unsupported') break;
  }
  const statuses=base.cases.map(c=>c.status);
  base.status=statuses.includes('timeout')?'timeout':statuses.includes('unsupported')?'unsupported':statuses.includes('runtime-error')?'runtime-error':statuses.includes('failed')?'failed':statuses.length===t.cases.length?'passed':'not-run';
  return base;
 } catch(e){base.status='unsupported';base.diagnostics.push(e instanceof Error?e.message:String(e));return base;}
 finally {if(runDir)await fs.rm(runDir,{recursive:true,force:true}).catch(()=>{});unlock();}
}
