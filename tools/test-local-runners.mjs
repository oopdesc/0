import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {grade} from '../contributions/shared-node/coordinator.mjs';
import {startLocalServer} from '../contributions/java/local-server.mjs';
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workDir=await fs.mkdtemp(path.join(os.tmpdir(),'zero-runner-check-'));
const dir=path.join(repoRoot,'web/public/learning-v2/rust');
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const questions=[];
for(const chunk of manifest.chunks)questions.push(...JSON.parse(await fs.readFile(path.join(dir,chunk.path),'utf8')));
const q=questions.find(q=>q.id==='rust:q0484');
const req=source=>({exerciseId:q.id,packVersion:manifest.contentVersion,files:[{path:'main.rs',content:source}],testSetId:'default'});
const context={repoRoot,workDir,language:'rust'};
let server;
try{
 const good=await grade(req(q.solution.files[0].content),context);assert.equal(good.status,'passed');
 const constant=await grade(req('fn sum_all(_xs: &[i32]) -> i32 { 0 }'),context);assert.equal(constant.status,'failed');
 const invalid=await grade(req('fn sum_all('),context);assert.equal(invalid.status,'compile-error');
 const mismatch=await grade(req(q.solution.files[0].content),{...context,language:'java'});assert.equal(mismatch.status,'unsupported');
 const {server:s,origin}=await startLocalServer({repoRoot,workDir,port:0});server=s;
 const page=await (await fetch(origin)).text();
 const token=page.match(/name="zero-java-local" content="([a-f0-9]{64})"/)?.[1];assert.ok(Boolean(token),'local marker present');
 const send=(body,headers={})=>fetch(origin+'/__zero_local/rust/grade',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Zero-Local-Token':token,...headers},body:JSON.stringify(body)});
 assert.equal((await send(req(q.solution.files[0].content),{Origin:'https://example.com'})).status,403);
 assert.equal((await send(req(q.solution.files[0].content),{'X-Zero-Local-Token':'0'.repeat(64)})).status,403);
 assert.equal((await send({...req(''),tests:[]})).status,400);
 assert.equal((await send({...req(''),files:[{path:'../../main.rs',content:''}]})).status,400);
 const response=await send(req(q.solution.files[0].content));assert.equal(response.status,200);assert.equal((await response.json()).status,'passed');
 console.log('Local runners: correct / wrong / compile-error / language / origin / session / test injection / path / HTTP grading passed (9 checks).');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await fs.rm(workDir,{recursive:true,force:true});
}
