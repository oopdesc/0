#!/usr/bin/env node
/** Explicitly started, same-origin, loopback-only Java teaching server.
 *
 * Serves a built web/dist and the trusted pack's fixed tests. It is NOT an OS
 * sandbox: run only your own code, on a machine without sensitive files or
 * credentials. It never accepts a shell command or client-supplied tests.
 */
import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {grade} from '../shared-node/coordinator.mjs';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const HOST='127.0.0.1', BODY_LIMIT=131072, SOURCE_LIMIT=65536, MAX_REQUESTS=4;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2'};
const plainObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exactKeys=(x,keys)=>plainObject(x)&&Object.keys(x).sort().join('\0')===[...keys].sort().join('\0');
const sameSecret=(received,expected)=>typeof received==='string'&&/^[a-f0-9]{64}$/.test(received)&&received.length===expected.length&&timingSafeEqual(Buffer.from(received,'ascii'),Buffer.from(expected,'ascii'));
function validateRequest(x,language){
 if(!exactKeys(x,['exerciseId','packVersion','files','testSetId'])||typeof x.exerciseId!=='string'||!new RegExp(`^${language}:[A-Za-z0-9._-]{1,120}$`).test(x.exerciseId)||typeof x.packVersion!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(x.packVersion)||x.testSetId!=='default'||!Array.isArray(x.files)||x.files.length!==1)return false;
 const f=x.files[0];return exactKeys(f,['path','content'])&&f.path===(language==='rust'?'main.rs':'Main.java')&&typeof f.content==='string'&&Buffer.byteLength(f.content,'utf8')<=SOURCE_LIMIT;
}
function headers(res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
}
function reply(res,status,value){if(res.destroyed||res.writableEnded)return;headers(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
function readBody(req){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0,done=false;
  const fail=e=>{if(done)return;done=true;req.resume();reject(e);};
  req.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>BODY_LIMIT){fail(new Error('body limit'));return;}chunks.push(chunk);});
  req.on('end',()=>{if(!done){done=true;resolve(Buffer.concat(chunks).toString('utf8'));}});
  req.on('error',fail);req.on('aborted',()=>fail(new Error('aborted')));
 });
}
/** The listener itself is always 127.0.0.1; port=0 is useful for local tests. */
export async function startLocalServer({repoRoot=defaultRoot,port=18423,workDir=os.tmpdir(),javaHome=process.env.JAVA_HOME}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('invalid port');
 const root=await fs.realpath(repoRoot), dist=await fs.realpath(path.join(root,'web/dist'));
 if(!(await fs.stat(dist)).isDirectory())throw new Error('web/dist not found: run npm run build first');
 const index=await fs.readFile(path.join(dist,'index.html'),'utf8');
 if(!/<head(?:\s[^>]*)?>/i.test(index))throw new Error('built index.html has no head');
 const secret=randomBytes(32).toString('hex');
 
 const context={repoRoot:root,language:'java',workDir,toolchains:{java:javaHome?{javac:path.join(javaHome,'bin/javac'),java:path.join(javaHome,'bin/java')}:{}},limits:{timeoutMs:5000}};
 let pending=0;
 const handle=async(req,res)=>{
  headers(res);
  const address=server.address();const origin=`http://${HOST}:${address?.port}`;
  // Bind, Host, Origin and a per-process secret prevent a public web page from
  // using this endpoint via DNS rebinding, simple form requests, or framing.
  if(req.socket.remoteAddress!==HOST||req.headers.host!==`${HOST}:${address?.port}`){reply(res,403,{error:'forbidden host'});return;}
  let url;try{url=new URL(req.url,origin);}catch{reply(res,400,{error:'invalid URL'});return;}
  if(url.origin!==origin){reply(res,403,{error:'forbidden URL'});return;}
  const language=url.pathname==='/__zero_local/java/grade'?'java':url.pathname==='/__zero_local/rust/grade'?'rust':null;
  if(language){
   if(req.method!=='POST'||url.search||req.headers.origin!==origin||!sameSecret(req.headers['x-zero-local-token'],secret)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')){reply(res,403,{error:'forbidden request'});return;}
   const length=req.headers['content-length'];
   if(typeof length!=='string'||!/^\d{1,6}$/.test(length)||Number(length)>BODY_LIMIT){reply(res,413,{error:'body too large or length missing'});req.resume();return;}
   if(pending>=MAX_REQUESTS){reply(res,429,{error:'local queue full'});req.resume();return;}
   pending++;
   try{
    let body;try{body=JSON.parse(await readBody(req));}catch{reply(res,400,{error:'invalid JSON or body'});return;}
    if(!validateRequest(body,language)){reply(res,400,{error:'invalid grade request'});return;}
    const result=await grade(body,{...context,language});
    reply(res,200,result);
   }catch{reply(res,500,{error:'local runner failed; no result was recorded'});}
   finally{pending--;}
   return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'method not allowed'});return;}
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{reply(res,400,{error:'invalid path'});return;}
  if(!pathname.startsWith('/')||pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').includes('..')){reply(res,400,{error:'invalid path'});return;}
  let candidate=path.resolve(dist,`.${pathname}`);
  if(candidate!==dist&&!candidate.startsWith(dist+path.sep)){reply(res,403,{error:'outside build'});return;}
  let real=null;try{real=await fs.realpath(candidate);if(real!==dist&&!real.startsWith(dist+path.sep))real=null;}catch{}
  let info=null;if(real)try{info=await fs.stat(real);}catch{}
  const isIndex=pathname==='/'||pathname==='/index.html'||(!info&&!path.extname(pathname))||(info?.isDirectory());
  if(isIndex){
   const currentIndex=await fs.readFile(path.join(dist,'index.html'),'utf8');
   const localIndex=currentIndex.replace(/<head(?:\s[^>]*)?>/i,match=>`${match}\n<meta name="zero-java-local" content="${secret}">`);
   res.writeHead(200,{'Content-Type':types['.html']});res.end(req.method==='HEAD'?undefined:localIndex);return;
  }
  if(!real||!info?.isFile()){reply(res,404,{error:'not found'});return;}
  try{
   const bytes=await fs.readFile(real);
   res.writeHead(200,{'Content-Type':types[path.extname(real).toLowerCase()]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{reply(res,500,{error:'cannot read built file'});}
 };
 const server=http.createServer((req,res)=>{void handle(req,res).catch(()=>reply(res,500,{error:'local request failed'}));});
 server.headersTimeout=10000;server.requestTimeout=15000;server.maxConnections=16;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,HOST,()=>{server.off('error',reject);resolve();});});
 return {server,origin:`http://${HOST}:${server.address().port}`};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length>2||(args.length&&args[0]!=='--port')||(args.length===2&&!/^\d{1,5}$/.test(args[1]))||args.length===1){console.error('usage: node contributions/java/local-server.mjs [--port 1024-65535]');process.exit(2);}
 const port=args.length?Number(args[1]):18423;
 if(port<1024||port>65535){console.error('port must be 1024-65535');process.exit(2);}
 try{
  const {origin}=await startLocalServer({port});
  console.log(`自分のPCだけで開く: ${origin}/learn?section=writing&lang=java`);
  console.log('自分のコードのみ実行。完全なOS隔離ではありません。Ctrl+Cで停止。');
 }catch(e){console.error('ローカル版を起動できません:',e instanceof Error?e.message:String(e));process.exit(1);}
}
