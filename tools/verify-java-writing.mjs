import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {grade} from '../contributions/shared-node/coordinator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'web/public/learning-v2/java');
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const javaHome=process.env.JAVA_HOME;
if(!javaHome)throw Error('JAVA_HOME required');
const context={repoRoot:root,language:'java',workDir:os.tmpdir(),toolchains:{java:{javac:path.join(javaHome,'bin/javac'),java:path.join(javaHome,'bin/java')}},limits:{timeoutMs:5000}};
const questions=[];
for(const chunk of manifest.chunks)questions.push(...JSON.parse(await fs.readFile(path.join(dir,chunk.path),'utf8')).filter(q=>q.writingRequired&&q.runnerProfile?.startsWith('java17-')));
const results=[];
const excluded=/ProcessBuilder|Runtime\s*\.\s*getRuntime|System\s*\.\s*(?:getenv|exit)|java\.net|\b(?:FileWriter|FileOutputStream|Socket)\b/;
for(const [index,q]of questions.entries()) {
  const file=q.solution.files.find(f=>f.path==='Main.java');
  if(!file||excluded.test(file.content+JSON.stringify(q.tests))){results.push({id:q.id,status:'not-run'});continue;}
  const result=await grade({exerciseId:q.id,packVersion:manifest.contentVersion,files:[{path:'Main.java',content:file.content}],testSetId:'default'},context);
  results.push({id:q.id,status:result.status,sourceDigest:result.sourceDigest,testsDigest:result.testsDigest,cases:result.cases,diagnostics:result.diagnostics,toolchain:result.toolchain});
  if((index+1)%20===0)console.log(`Java fixed-test replay: ${index+1}/${questions.length}`);
}
const output=process.env.ZERO_AUDIT_OUTPUT||path.join(root,'.local/java-writing-replay.json');
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
const totals={};for(const r of results)totals[r.status]=(totals[r.status]??0)+1;console.log(totals);
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
