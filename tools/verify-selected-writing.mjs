import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {grade} from '../contributions/shared-node/coordinator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.ZERO_AUDIT_OUTPUT||path.join(root,'.local/selected-writing-replay.json');
const results=[];
for(const language of ['java','rust']){
 const dir=path.join(root,'web/public/learning-v2',language),m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 const qs=JSON.parse(await fs.readFile(path.join(dir,'selected-writing.json'),'utf8'));
 const context={repoRoot:root,language,workDir:os.tmpdir(),toolchains:{java:{javac:path.join(process.env.JAVA_HOME,'bin/javac'),java:path.join(process.env.JAVA_HOME,'bin/java')}}};
 for(const q of qs){
  const r=await grade({exerciseId:q.id,packVersion:m.contentVersion,files:[{path:language==='java'?'Main.java':'main.rs',content:q.solution.files[0].content}],testSetId:'default'},context);
  results.push({id:q.id,status:r.status,cases:r.cases,diagnostics:r.diagnostics,sourceDigest:r.sourceDigest,testsDigest:r.testsDigest,toolchain:r.toolchain});
 }
 console.log(language,results.filter(r=>r.id.startsWith(language+':')).reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}));
}
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
