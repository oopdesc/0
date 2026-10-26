import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(path.join(root, 'web/package.json'));
const sharp = require('sharp'); sharp.concurrency(2);
const names = ['github-thumbnail', 'chatgpt-thumbnail', 'huggingface-thumbnail', 'youtube-thumbnail0'];
const report = [];
for (const name of names) {
  const input = path.join(root, `web/public/images/${name}.jpg`);
  if (!existsSync(input)) continue;
  const result = await sharp(input).resize(640, 400, { fit: 'cover', position: 'centre', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(path.join(root, `web/public/images/${name}.webp`));
  report.push({ name, webpBytes: result.size, width: result.width, height: result.height, metadataStripped: true });
  unlinkSync(input); // Only this script's new, copied build input. Original Git asset is preserved.
}
const unused = path.join(root, 'web/public/images/amazonkindle-thumbnail.jpg');
if (existsSync(unused)) unlinkSync(unused);
writeFileSync(path.join(root, 'web/image-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
