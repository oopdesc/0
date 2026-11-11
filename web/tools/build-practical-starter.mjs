import { readFileSync, writeFileSync } from 'node:fs';
const files = [
  ['README-START.md','README-START.md'], ['SOLUTION.md','SOLUTION.md'],
  ['java/BookService.java','workplace-java/BookService.java'],
  ['java/WorkplaceTest.java','workplace-java/WorkplaceTest.java'],
  ['rust/Cargo.toml','workplace-rust/Cargo.toml'],
  ['rust/src/lib.rs','workplace-rust/src/lib.rs'],
].map(([source, path]) => ({ path, content:readFileSync(new URL('../practical/'+source, import.meta.url),'utf8') }));
writeFileSync(new URL('../public/learning-v2/workplace-starter.json',import.meta.url),JSON.stringify({schema:'zero-workplace-starter/1',files})+'\n');
console.log(`Prepared ${files.length} explicit practical starter files; no directory scan.`);
