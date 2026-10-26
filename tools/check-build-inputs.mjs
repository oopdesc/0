import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const java = read('web/src/java-manifest.json');
const wasm = read('web/src/wasm-manifest.json');
const media = read('web/src/media-manifest.json');
const required = [...new Set([
  'package.json', 'package-lock.json', 'vercel.json', 'tools/check-release.mjs',
  'web/package.json', 'web/package-lock.json', 'web/index.html', 'web/vite.config.ts',
  'web/src/java-manifest.json', 'web/src/wasm-manifest.json', 'web/src/media-manifest.json',
  java.path, ...Object.keys(java.sourceHashes), ...Object.keys(wasm.sourceHashes),
  'web/public/' + wasm.url.replace(/^\//, ''),
  ...media.map(file => 'web/public/' + file.path),
])];
for (const name of required) {
  assert(!name.split('/').some(p => p.startsWith('[')), 'Private location refused');
}
// Vercel uses gitignore-style patterns. Query the same patterns without changing Git settings.
const result = spawnSync('git', ['-c', 'core.excludesFile=' + path.join(root, '.vercelignore'),
  'check-ignore', '--no-index', '--stdin', '-z'], {
  cwd: root, input: required.join('\0') + '\0', encoding: 'utf8',
});
assert(result.status === 0 || result.status === 1, 'Unable to check deployment include rules');
const missing = result.stdout.split('\0').filter(Boolean);
assert.deepEqual(missing, [], 'Required build input excluded from deployment');
console.log(`Deployment input check: ${required.length} source/media inputs are included.`);
