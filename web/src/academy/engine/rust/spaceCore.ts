/**
 * Rust（wasm32）で書いた粒子コアの読み込み。
 * wasm-bindgen を使わず、生の extern "C" をそのまま呼ぶ。
 * 返ってくるのは wasm の線形メモリ上の f32 配列で、コピーせずに覗く。
 *
 * ビルド: tools/build-wasm.mjs（rustc --target wasm32-unknown-unknown）
 */
/**
 * アセット URL の解決。
 * Vite は `new URL('./...', import.meta.url)` を静的解析して、
 * ビルド時にハッシュ付きのファイル名へ置き換える（?url import と違い、
 * Node のテストから読み込んでも構文エラーにならない）。
 */
const wasmUrl = new URL('../../space/assets/space-core.wasm', import.meta.url).href;

export const PARTICLE_STRIDE = 8; // x, y, vx, vy, life, seed, size, glow
export const LINK_STRIDE = 5; // x1, y1, x2, y2, strength

interface Exports {
  memory: WebAssembly.Memory;
  sc_init: (count: number, seed: number) => void;
  sc_step: (dt: number, cx: number, cy: number, attract: number, w: number, h: number) => void;
  sc_spawn: (x: number, y: number, n: number) => void;
  sc_particles_ptr: () => number;
  sc_links_ptr: () => number;
  sc_link_count: () => number;
  sc_count: () => number;
  sc_stride: () => number;
  sc_link_stride: () => number;
  sc_time: () => number;
}

export interface SpaceCore {
  init(count: number, seed: number): void;
  step(dt: number, cx: number, cy: number, attract: number, w: number, h: number): void;
  spawn(x: number, y: number, n: number): void;
  particles(): Float32Array;
  links(): Float32Array;
  linkCount(): number;
  count(): number;
  time(): number;
  /** wasm のバージョン情報（画面に出す） */
  readonly version: string;
}

let cached: Promise<SpaceCore | null> | null = null;

export function loadSpaceCore(): Promise<SpaceCore | null> {
  if (!cached) cached = load();
  return cached;
}

/** テスト用: 成功/失敗の結果を捨ててやり直す */
export function resetSpaceCoreCache(): void {
  cached = null;
}

async function load(): Promise<SpaceCore | null> {
  try {
    const res = await fetch(wasmUrl);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const e = instance.exports as unknown as Exports;

    const view = (ptr: number, len: number) => new Float32Array(e.memory.buffer, ptr, len);

    return {
      version: 'Rust wasm32 (space-core)',
      init(count, seed) {
        e.sc_init(count, seed);
      },
      step(dt, cx, cy, attract, w, h) {
        e.sc_step(dt, cx, cy, attract, w, h);
      },
      spawn(x, y, n) {
        e.sc_spawn(x, y, n);
      },
      particles() {
        // メモリが伸びると ArrayBuffer が変わるので毎回作り直す
        return view(e.sc_particles_ptr(), e.sc_count() * e.sc_stride());
      },
      links() {
        return view(e.sc_links_ptr(), e.sc_link_count() * e.sc_link_stride());
      },
      linkCount() {
        return e.sc_link_count();
      },
      count() {
        return e.sc_count();
      },
      time() {
        return e.sc_time();
      },
    };
  } catch {
    return null;
  }
}
