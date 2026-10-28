#!/usr/bin/env node
/** Manual local CLI: node contributions/shared-node/cli.mjs java:q0019 Main.java */
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { grade } from './coordinator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const explicit=args[0]==='--language'?args[1]:null;
const [id,sourcePath]=explicit?args.slice(2):args;
const inferred=/^(java|rust):/.exec(id||'')?.[1];
const language=explicit||inferred;
if(!id||!sourcePath||!['java','rust'].includes(language)||(explicit&&inferred&&explicit!==inferred)){console.error('使い方: node contributions/shared-node/cli.mjs [--language java|rust] exerciseId Main.java');process.exit(2);}
const manifest=JSON.parse(await readFile(path.join(root,'web/public/learning-v2',language,'manifest.json'),'utf8'));
const st=await stat(sourcePath);if(!st.isFile()||st.size>65536)throw Error('source must be a regular file up to 65536 bytes');
const content=await readFile(sourcePath,'utf8');
const home=process.env.JAVA_HOME;
const context={repoRoot:root,language,workDir:os.tmpdir(),toolchains:{java:home?{javac:path.join(home,'bin/javac'),java:path.join(home,'bin/java')}:{}},limits:{timeoutMs:5000}};
const result=await grade({exerciseId:id,packVersion:manifest.contentVersion,files:[{path:language==='java'?'Main.java':'main.rs',content}],testSetId:'default'},context);
console.log(JSON.stringify(result,null,2));
process.exitCode=result.status==='passed'?0:1;
