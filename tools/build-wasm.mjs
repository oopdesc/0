import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const cwd = path.join(root, 'backend/rust');
const cargo = process.env.CARGO || path.join(process.env.HOME, '.cargo/bin/cargo');
const result = spawnSync(cargo, ['build', '--offline', '-j', '2', '--release', '--target', 'wasm32-unknown-unknown', '-p', 'cosmic-core'], { cwd, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const hash = b => createHash('sha256').update(b).digest('hex');
const bytes = readFileSync(path.join(cwd, 'target/wasm32-unknown-unknown/release/cosmic_core.wasm'));
const sha256 = hash(bytes), name = `cosmic-core-${sha256.slice(0, 12)}.wasm`;
const output = path.join(root, 'web/public/wasm'); mkdirSync(output, { recursive: true });
const manifestFile = path.join(root, 'web/src/wasm-manifest.json');
if (existsSync(manifestFile)) {
  const previous = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const oldName = path.basename(previous.url || '');
  // Delete only the previously generated, content-addressed output, never a directory.
  if (/^cosmic-core-[0-9a-f]{12}\.wasm$/.test(oldName) && oldName !== name && existsSync(path.join(output, oldName))) unlinkSync(path.join(output, oldName));
}
writeFileSync(path.join(output, name), bytes);
const sources = ['backend/rust/Cargo.toml', 'backend/rust/cosmic-core/Cargo.toml', 'backend/rust/cosmic-core/src/lib.rs'];
const manifest = { url: `/wasm/${name}`, sha256, bytes: bytes.length, sourceHashes: Object.fromEntries(sources.map(f => [f, hash(readFileSync(path.join(root, f)))])) };
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rust Wasm ready: ${bytes.length} bytes, ${name}`);
