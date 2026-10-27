export const STAR_COUNT = 900;
export const STAR_SEED = 0x00c05a1c;
export type StarEngine = 'wasm' | 'typescript';
export interface Starfield { points: Float32Array; engine: StarEngine }

/** Bit-for-bit deterministic input sequence; values are visual decoration, not observations. */
export function fallbackStars(seed: number, count: number): Float32Array {
  const safeCount = Math.max(0, Math.min(4096, Math.floor(count)));
  const out = new Float32Array(safeCount * 4);
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) / 16777216; };
  for (let i = 0; i < safeCount; i++) {
    out[i * 4] = next(); out[i * 4 + 1] = next();
    out[i * 4 + 2] = Math.fround(Math.fround(0.3) + Math.fround(next() * Math.fround(1.25)));
    out[i * 4 + 3] = Math.fround(Math.fround(0.18) + Math.fround(next() * Math.fround(0.55)));
  }
  return out;
}
let cached: Promise<Starfield> | null = null;
export function loadStarfield(): Promise<Starfield> {
  if (!cached) cached = (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}wasm/orbit-starfield.wasm`);
      if (!response.ok) throw new Error('wasm unavailable');
      const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
      const memory = instance.exports.memory;
      const generate = instance.exports.generate_stars;
      if (!(memory instanceof WebAssembly.Memory) || typeof generate !== 'function') throw new Error('invalid wasm exports');
      const pointer = generate(STAR_SEED, STAR_COUNT) as number;
      if (!Number.isSafeInteger(pointer) || pointer < 0 || pointer + STAR_COUNT * 16 > memory.buffer.byteLength) throw new Error('invalid wasm buffer');
      return { points: new Float32Array(memory.buffer, pointer, STAR_COUNT * 4).slice(), engine: 'wasm' as const };
    } catch { return { points: fallbackStars(STAR_SEED, STAR_COUNT), engine: 'typescript' as const }; }
  })();
  return cached;
}
