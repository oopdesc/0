import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const javaHome = process.env.JAVA_HOME || execFileSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' }).trim();
const result = spawnSync('mvn', ['-q', '-o', '-T', '2', '-f', 'frontend/java-problems/pom.xml', 'package', '-DskipTests'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, JAVA_HOME: javaHome, MAVEN_OPTS: '-XX:ActiveProcessorCount=2 -Xmx768m' },
});
if (result.status !== 0) process.exit(result.status || 1);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.from(readFileSync(path.join(root, 'frontend/java-problems/target/javascript/problems-model.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/gm, ''));
const sources = ['frontend/java-problems/pom.xml', 'frontend/java-problems/src/main/java/cosmic/browser/Problems.java', 'tools/build-problem-java.mjs'];
writeFileSync(path.join(root, 'web/src/generated/problems-model.js'), bytes);
writeFileSync(path.join(root, 'web/src/problems/java-manifest.json'), JSON.stringify({ path: 'web/src/generated/problems-model.js', compiler: 'TeaVM 0.16.0', sha256: hash(bytes), bytes: bytes.length, sourceHashes: Object.fromEntries(sources.map(f => [f, hash(readFileSync(path.join(root, f)))])) }, null, 2) + '\n');
console.log(`Fixed Java problem module rebuilt: ${bytes.length} bytes`);
