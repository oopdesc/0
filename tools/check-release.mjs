import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
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
visit(dist);
assert(total <= 30 * 1024 * 1024, 'Static release exceeds 30MiB review budget');
assert(jsGzip <= 512 * 1024, 'JavaScript exceeds 512KiB gzip review budget');
const meta = JSON.parse(readFileSync(path.join(root, 'web/src/wasm-manifest.json'), 'utf8'));
assert.equal(hash(readFileSync(path.join(dist, meta.url))), meta.sha256, 'Wasm digest mismatch');
for (const [file, sha] of Object.entries(meta.sourceHashes)) {
  assert.equal(hash(readFileSync(path.join(root, file))), sha, 'Rust source changed: rebuild Wasm locally before publishing');
}
const javaMeta = JSON.parse(readFileSync(path.join(root, 'web/src/java-manifest.json'), 'utf8'));
assert.equal(hash(readFileSync(path.join(root, javaMeta.path))), javaMeta.sha256, 'Java browser module digest mismatch');
for (const [file, sha] of Object.entries(javaMeta.sourceHashes)) assert.equal(hash(readFileSync(path.join(root, file))), sha, 'Java source changed: rebuild the browser module');
const mediaMeta = JSON.parse(readFileSync(path.join(root, 'web/src/media-manifest.json'), 'utf8'));
for (const file of mediaMeta) assert.equal(hash(readFileSync(path.join(dist, file.path))), file.sha256, 'Observation media digest mismatch');
const report = { files, totalBytes: total, javaScriptGzipBytes: jsGzip, wasmBytes: meta.bytes, javaBrowserBytes: javaMeta.bytes, limits: { staticBytes: 30 * 1024 * 1024, javaScriptGzipBytes: 512 * 1024 }, privateDocumentsIncluded: false, functions: 0, monthlyTransferGuaranteed: false };
writeFileSync(path.join(root, 'web/release-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Release budget and privacy checks passed:', JSON.stringify(report));
