import type { Question } from "./types";
const bytes = (s: string) => new TextEncoder().encode(s).byteLength;
export function canArchiveExercise(q: Question): boolean {
  const t = q.tests.filter((x) => x.id === "default");
  return (
    q.writingRequired &&
    q.id.startsWith(q.language + ":") &&
    /^(java|rust):q\d{4,}$/.test(q.id) &&
    q.setup.files.length === 1 &&
    q.setup.dependencies.length === 0 &&
    t.length === 1 &&
    t[0].cases.length > 0 &&
    t[0].cases.length <= 32 &&
    t[0].testFiles.every((f) => f.editable === false) &&
    t[0].cases.every(
      (c) =>
        c.expectedCompile === "pass" &&
        c.expectedExit === 0 &&
        bytes(c.stdin) <= 65536,
    ) &&
    ((q.language === "java" &&
      ["java17-harness-v1", "java17-stdio-v1"].includes(
        q.runnerProfile ?? "",
      ) &&
      q.setup.files[0].path === "Main.java" &&
      ((t[0].mode === "stdio" && t[0].testFiles.length === 0) ||
        (t[0].mode === "harness" &&
          t[0].testFiles.length === 1 &&
          t[0].testFiles[0].path === "Harness.java"))) ||
      (q.language === "rust" &&
        q.runnerProfile === "rust2021-fixed-v1" &&
        q.setup.files[0].path === "main.rs" &&
        t[0].mode === "harness" &&
        t[0].testFiles.length === 1 &&
        t[0].testFiles[0].path === "Harness.rs"))
  );
}
// This helper is a local development tool, not a security sandbox. It never
// downloads a compiler or calls a remote judge. No shell command interpolation.
export const OFFLINE_RUNNER = String.raw`import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const contractFile=path.join(root,'exercise.json');
const contractStat=await fs.lstat(contractFile);if(!contractStat.isFile()||contractStat.isSymbolicLink()||contractStat.size>2097152)throw Error('Invalid fixed-test file');
const data=JSON.parse(await fs.readFile(contractFile,'utf8'));
const textFile=async name=>{const p=path.join(root,name),st=await fs.lstat(p);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)throw Error('Invalid source: '+name);return fs.readFile(p,'utf8');};
if(data.schema!=='zero-offline-exercise/1'||!['java','rust'].includes(data.language)||!['harness','stdio'].includes(data.mode)||!Array.isArray(data.cases)||!data.cases.length||data.cases.length>32||data.cases.some(c=>typeof c.id!=='string'||typeof c.stdin!=='string'||!Array.isArray(c.expectedStdout)||c.expectedStdout.some(s=>typeof s!=='string')))throw Error('Invalid fixed tests');
const work=await fs.mkdtemp(path.join(os.tmpdir(),'zero-offline-'));
const run=(bin,args,input='',timeout=6000,compiler=false)=>spawnSync(bin,args,{cwd:work,input,encoding:'utf8',timeout,maxBuffer:65536,shell:false,env:{PATH:process.env.PATH,LANG:'C.UTF-8',HOME:compiler?os.homedir():work,TMPDIR:work,...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot,PATHEXT:process.env.PATHEXT}:{}),...(compiler&&process.env.RUSTUP_HOME?{RUSTUP_HOME:process.env.RUSTUP_HOME}:{}),...(compiler&&process.env.CARGO_HOME?{CARGO_HOME:process.env.CARGO_HOME}:{})}});
const lines=text=>{const value=(text??'').replace(/\r\n?/g,'\n');return value===''?[]:(value.endsWith('\n')?value.slice(0,-1):value).split('\n');};
try{
 let compile,bin,args;
 if(data.language==='java'){
  await fs.mkdir(path.join(work,'classes'));await fs.writeFile(path.join(work,'Main.java'),await textFile('Main.java'));
  if(data.mode==='harness')await fs.writeFile(path.join(work,'Harness.java'),await textFile('Harness.java'));
  const suffix=process.platform==='win32'?'.exe':'',jdk=process.env.JAVA_HOME;
  const javac=jdk?path.join(jdk,'bin','javac'+suffix):'javac';bin=jdk?path.join(jdk,'bin','java'+suffix):'java';
  compile=run(javac,['-J-XX:ActiveProcessorCount=2','-J-Xmx256m','--release','17','-encoding','UTF-8','-d','classes','Main.java',...(data.mode==='harness'?['Harness.java']:[])] ,'',10000,true);
  args=['-Xmx64m','-XX:ActiveProcessorCount=1','-Dfile.encoding=UTF-8','-cp','classes',data.mode==='harness'?'Harness':'Main'];
 }else{
  await fs.writeFile(path.join(work,'main.rs'),await textFile('main.rs')+'\n'+await textFile('Harness.rs'));
  bin=path.join(work,process.platform==='win32'?'exercise.exe':'exercise');args=[];
  compile=run('rustc',['--edition=2021','-C','codegen-units=1','-Awarnings','main.rs','-o',bin] ,'',10000,true);
 }
 if(compile.error||compile.status!==0){console.error('コンパイルできませんでした。JDK 17以上 / RustとPATHも確認してください。');console.error(String(compile.stderr||compile.error).slice(0,6000));process.exitCode=1;}
 else{
  let passed=0;
  for(const c of data.cases){const result=run(bin,args,c.stdin,3000);const ok=!result.error&&result.status===0&&JSON.stringify(lines(result.stdout))===JSON.stringify(c.expectedStdout);if(ok)passed++;console.log((ok?'PASS ':'FAIL ')+c.id);if(!ok){console.log('expected:',JSON.stringify(c.expectedStdout));console.log('actual:  ',JSON.stringify(lines(result.stdout)));if(result.stderr||result.error)console.error(String(result.stderr||result.error).slice(0,2000));}}
  console.log(passed+'/'+data.cases.length+' fixed cases passed');if(passed!==data.cases.length)process.exitCode=1;
 }
}finally{await fs.rm(work,{recursive:true,force:true});}
`;

export function exerciseFiles(
  q: Question,
  source: string,
): Record<string, string> {
  if (!canArchiveExercise(q) || bytes(source) > 65536)
    throw Error("この問題は固定テスト一式の保存に対応していません。");
  const test = q.tests.find((t) => t.id === "default")!;
  if (test.testFiles.some((f) => bytes(f.content) > 65536))
    throw Error("固定テストが大きすぎます。");
  const files: Record<string, string> = {
    [q.setup.files[0].path]: source,
    "exercise.json":
      JSON.stringify(
        {
          schema: "zero-offline-exercise/1",
          id: q.id,
          language: q.language,
          version: q.contentVersion,
          mode: test.mode,
          cases: test.cases.map((c) => ({
            id: c.id,
            stdin: c.stdin,
            expectedStdout: c.expectedStdout,
          })),
        },
        null,
        2,
      ) + "\n",
    "run-tests.mjs": OFFLINE_RUNNER,
    "README.txt": [
      q.title,
      "",
      q.prompt,
      "",
      "■ 実行方法",
      "Node.js 22以上と、JDK 17以上またはRust stableを用意します。ネット接続・APIキー・有料サービスは使いません。",
      "展開したフォルダで、次のコマンドを実行してください。",
      "",
      "node run-tests.mjs",
      "",
      "" +
        test.cases.length +
        "件の固定ケースを逐次実行します。実行は自分で確認したコードだけにしてください。OSによる完全な隔離ではありません。",
      "固定テストを通過しても、全入力・性能・実DBでの動作を証明したことにはなりません。",
      q.language === "java"
        ? "■ Eclipse: General → Existing Projects into Workspaceでこのフォルダを取り込みます。JavaSE-17以上のJDKを設定してください。Harness.javaがある場合はRun/Debug as Java Applicationで起動し、Consoleへfixture番号（0など）を1行入力して1ケースを追えます。"
        : "■ Eclipse: main.rsを開いて編集できます。ケースの実行は上のコマンドで行います。Cargoプロジェクトとしてのデバッグ練習は、サイトの「小プロジェクト」で用意しています。",
      "",
      "reference/ は模範解答です。採点器はこのフォルダを使いません。まず自分で考えたいときは開かずに進めてください。",
      "",
      "■ 考え方",
      ...q.solution.reasoningSteps.map((s, i) => i + 1 + ". " + s),
      "",
      "■ 参照",
      ...q.solution.references.map((r) => r.title + "\n" + r.url),
      "",
      "サイトのソースコードとこの教材の利用条件: MIT License",
      "https://github.com/oopdesc/0/blob/main/LICENSE",
      "",
    ].join("\n"),
  };
  for (const f of test.testFiles) files[f.path] = f.content;
  for (const f of q.solution.files) {
    if (!/^(Main\.java|main\.rs)$/.test(f.path))
      throw Error("参照解答のファイル名が不正です。");
    files["reference/" + f.path] = f.content;
  }
  if (q.language === "java") {
    files[".project"] =
      '<?xml version="1.0" encoding="UTF-8"?><projectDescription><name>0_java_' +
      q.id.split(":")[1] +
      "</name><comment></comment><projects></projects><buildSpec><buildCommand><name>org.eclipse.jdt.core.javabuilder</name><arguments></arguments></buildCommand></buildSpec><natures><nature>org.eclipse.jdt.core.javanature</nature></natures></projectDescription>";
    files[".classpath"] =
      '<?xml version="1.0" encoding="UTF-8"?><classpath><classpathentry kind="src" path="" excluding="reference/**"/><classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-17"/><classpathentry kind="output" path="bin"/></classpath>';
    files[".settings/org.eclipse.jdt.core.prefs"] =
      "eclipse.preferences.version=1\norg.eclipse.jdt.core.compiler.codegen.targetPlatform=17\norg.eclipse.jdt.core.compiler.compliance=17\norg.eclipse.jdt.core.compiler.source=17\n";
  }
  return files;
}
export async function buildExerciseArchive(
  q: Question,
  source: string,
): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate");
  const files = exerciseFiles(q, source),
    root = "0-" + q.id.replace(":", "-") + "/";
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        root + name,
        strToU8(content),
      ]),
    ),
    { level: 6 },
  );
}
