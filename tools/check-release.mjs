import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'web/dist');
const hash = b => createHash('sha256').update(b).digest('hex');
let total = 0, jsGzip = 0, files = 0;
function visit(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    assert(!entry.name.startsWith('['), 'Bracket-prefixed private name refused before access');
    const p = path.join(folder, entry.name), status = lstatSync(p);
    assert(!status.isSymbolicLink(), 'No linked deployment assets');
    if (status.isDirectory()) { visit(p); continue; }
    assert(status.isFile() && status.nlink === 1, 'Only unlinked regular release files');
    assert(!/\.(pdf|docx?|pem|key|db|sqlite|zip)$/i.test(p), 'Private documents/credentials are not deployable');
    assert(!/^\.env/i.test(entry.name), 'No environment files');
    assert(status.size < 20 * 1024 * 1024, 'Single asset must be smaller than 20MiB');
    total += status.size; files++;
    if (/\.js$/.test(p)) jsGzip += gzipSync(readFileSync(p)).length;
    if (/\.(js|html|css)$/.test(p)) assert(!/(?:Resume|CareerHistory)|rlkey=|\/docs\/[^\s]+\.(pdf|docx)/.test(readFileSync(p, 'utf8')), 'Legacy document route in public output');
  }
}
// Follow static imports as well as the entry itself. Dynamic scenes are measured
// separately, so the initial-page budget cannot hide a large static dependency.
const manifestFile = path.join(dist, 'release-manifest.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const entryKey = Object.keys(manifest).find(k => manifest[k].isEntry);
assert(entryKey, 'Build manifest has no entry');
function payload(keys, extraAssets = []) {
  const chunks = new Set(), assets = new Set(['index.html', ...extraAssets]);
  function add(key) {
    if (chunks.has(key)) return;
    chunks.add(key);
    const item = manifest[key];
    assert(item, `Missing build input: ${key}`);
    assets.add(item.file);
    for (const file of [...(item.css ?? []), ...(item.assets ?? [])]) assets.add(file);
    for (const dep of item.imports ?? []) add(dep);
  }
  keys.forEach(add);
  let rawBytes = 0, gzipEstimateBytes = 0, javaScriptGzipBytes = 0;
  for (const file of assets) {
    const bytes = readFileSync(path.join(dist, file));
    const size = /\.(js|css|html|json|svg|wasm)$/.test(file) ? gzipSync(bytes).length : bytes.length;
    rawBytes += bytes.length; gzipEstimateBytes += size;
    if (file.endsWith('.js')) javaScriptGzipBytes += size;
  }
  return { rawBytes, gzipEstimateBytes, javaScriptGzipBytes, files: [...assets] };
}
const pagePayloads = {
  home: payload([entryKey]),
  learning: payload([entryKey, 'src/LearningHub.tsx']),
  questions: payload([entryKey, 'src/LearningHub.tsx', 'src/learning-v2/PackLearning.tsx']),
  catalog: payload([entryKey, 'src/LearningHub.tsx', 'src/learning-v2/QuestionCatalog.tsx'], ['learning-v2/catalog.json']),
  orbit: payload([entryKey, 'src/art/OrbitShowcase.tsx']),
  nebula: payload([entryKey, 'src/art/NebulaExperience.tsx']),
  homeNebula: payload([entryKey, 'src/art/nursery/renderer.ts'], ['cosmos/nursery-poster.webp']),
};
// The manifest is a local verification input, not a deployed asset.
unlinkSync(manifestFile);
visit(dist);
assert(total <= 30 * 1024 * 1024, 'Static release exceeds 30MiB review budget');
assert(jsGzip <= 1024 * 1024, 'JavaScript exceeds 1MiB gzip total lazy-module review budget');
const initialFile = readFileSync(path.join(dist, 'index.html'), 'utf8').match(/src="([^"]+\.js)"/);
assert(initialFile, 'Initial entry script missing');
const initialGzip = pagePayloads.home.javaScriptGzipBytes;
assert(initialGzip <= 128 * 1024, 'Initial JavaScript exceeds 128KiB gzip');
const meta = JSON.parse(readFileSync(path.join(root, 'web/src/wasm-manifest.json'), 'utf8'));
assert.equal(hash(readFileSync(path.join(dist, meta.url))), meta.sha256, 'Wasm digest mismatch');
for (const [file, sha] of Object.entries(meta.sourceHashes)) {
  assert.equal(hash(readFileSync(path.join(root, file))), sha, 'Rust source changed: rebuild Wasm locally before publishing');
}
const javaMeta = JSON.parse(readFileSync(path.join(root, 'web/src/java-manifest.json'), 'utf8'));
assert.equal(hash(readFileSync(path.join(root, javaMeta.path))), javaMeta.sha256, 'Java browser module digest mismatch');
for (const [file, sha] of Object.entries(javaMeta.sourceHashes)) assert.equal(hash(readFileSync(path.join(root, file))), sha, 'Java source changed: rebuild the browser module');
const problemJava = JSON.parse(readFileSync(path.join(root, 'web/src/problems/java-manifest.json'), 'utf8'));
assert.equal(hash(readFileSync(path.join(root, problemJava.path))), problemJava.sha256, 'Fixed Java problem module digest mismatch');
for (const [file, sha] of Object.entries(problemJava.sourceHashes)) assert.equal(hash(readFileSync(path.join(root, file))), sha, 'Fixed Java problem source changed: rebuild the browser module');
const mediaMeta = JSON.parse(readFileSync(path.join(root, 'web/src/media-manifest.json'), 'utf8'));
for (const file of mediaMeta) assert.equal(hash(readFileSync(path.join(dist, file.path))), file.sha256, 'Observation media digest mismatch');
const report = { files, totalBytes: total, javaScriptGzipBytes: jsGzip, initialJavaScriptGzipBytes: initialGzip, pagePayloads, payloadMethod: 'static import closure plus selected lazy route; gzip estimate, cold browser; excludes headers and interaction-selected media', wasmBytes: meta.bytes, javaBrowserBytes: javaMeta.bytes, limits: { staticBytes: 30 * 1024 * 1024, javaScriptGzipBytes: 1024 * 1024, initialJavaScriptGzipBytes: 128 * 1024 }, privateDocumentsIncluded: false, functions: 0, monthlyTransferGuaranteed: false };
writeFileSync(path.join(root, 'web/release-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Release budget and privacy checks passed:', JSON.stringify(report));
