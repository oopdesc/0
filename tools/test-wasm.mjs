import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const meta = JSON.parse(readFileSync(new URL('../web/src/wasm-manifest.json', import.meta.url), 'utf8'));
const { instance } = await WebAssembly.instantiate(readFileSync(new URL('../web/public' + meta.url, import.meta.url)), {});
const api = instance.exports;
const read = () => new Float32Array(api.memory.buffer, api.galaxy_ptr(), api.galaxy_len()).slice();
assert.equal(api.galaxy_generate(1200, 42), 1200);
const one = read(); assert.equal(one.length, 4800); assert(one.every(Number.isFinite));
api.galaxy_generate(1200, 42); assert.deepEqual(one, read());
api.galaxy_generate(1200, 43); assert.notDeepEqual(one, read());
assert.equal(api.galaxy_generate(0xffffffff, 1), 32000); assert.equal(read().length, 128000);
assert.equal(api.galaxy_generate(0, 1), 0); assert.equal(read().length, 0);
console.log('Wasm bridge: shape, finite values, determinism, seed changes and allocation bounds passed.');

for (const mode of [0,1,2,3]) {
 assert.equal(api.cosmic_generate(mode,200,42),200);const cloud=read();assert(cloud.every(Number.isFinite));
 api.cosmic_generate(mode,200,42);assert.deepEqual(read(),cloud);
 if(mode===1)for(let i=0;i<cloud.length;i+=4)assert(Math.hypot(cloud[i],cloud[i+1])>=.234);
 if(mode===3)for(let i=0;i<cloud.length;i+=4){const r=Math.hypot(...cloud.slice(i,i+3));assert(r>=5.999&&r<=15.001);}
}
assert.equal(api.cosmic_generate(1,0xffffffff,1),32000);
console.log('3D Wasm: galaxy/accretion/background geometry, deterministic data and count bounds passed.');
