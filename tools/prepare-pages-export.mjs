// Build first. Prepare a portable static copy; never create an account or deploy.
import { readFileSync, readdirSync, lstatSync, cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'web/dist');
const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
let files = 0, bytes = 0, largest = 0;
function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    assert(!entry.name.startsWith('['), 'Private location refused before access');
    const file = path.join(dir, entry.name), s = lstatSync(file);
    assert(!s.isSymbolicLink(), 'No symlinked output');
    if (s.isDirectory()) { inspect(file); continue; }
    assert(s.isFile() && s.nlink === 1, 'Only ordinary public assets');
    assert(!/^\.env|\.(?:pem|key|pdf|docx?|db|sqlite|zip)$/i.test(entry.name), 'Private file refused');
    assert(s.size < 25 * 1024 * 1024, 'Cloudflare Pages single-file limit exceeded');
    files++; bytes += s.size; largest = Math.max(largest, s.size);
  }
}
inspect(dist);
assert(files + 3 <= 20000, 'Cloudflare Pages Free file-count limit exceeded');
assert(bytes <= 30 * 1024 * 1024, 'Local static review budget exceeded');
const output = mkdtempSync(path.join(tmpdir(), 'zero-pages-export-'));
cpSync(dist, output, { recursive: true });
const redirects = [
  ...config.redirects.map(r => `${r.source} ${r.destination} ${r.permanent ? 301 : 302}`),
  ...config.rewrites.map(r => `${r.source} ${r.destination} 200`),
];
writeFileSync(path.join(output, '_redirects'), redirects.join('\n') + '\n');
const pattern = s => s.replace('/(.*)', '/*').replace('/:path*', '/*');
const headers = config.headers.map(rule => [pattern(rule.source), ...rule.headers.map(h => `  ${h.key}: ${h.value}`)].join('\n')).join('\n\n');
assert(headers.split('\n').every(line => line.length <= 2000), 'Header line limit');
writeFileSync(path.join(output, '_headers'), headers + '\n');
writeFileSync(path.join(output, '404.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><title>ページが見つかりません</title><h1>ページが見つかりません</h1><p><a href="/">学習サイトのトップへ戻る</a></p></html>\n');
console.log(JSON.stringify({ output, files:files+3, staticBytes:bytes, largestAssetBytes:largest, functions:0, deployed:false, accountCreated:false, paidServicesAdded:false }, null, 2));
