/**
 * Optional WASM acceleration. The app is fully functional without it.
 *
 * Progressive enhancement contract:
 *   - If fetch / instantiate / ABI check fails, the caller gets the TS kernel.
 *   - No network service, no API key, no build-time secret.
 *   - Memory views are rebuilt after growth (a detached buffer is a classic bug).
 */
import { hash01 as tsHash01 } from './rng';
import { stepReference, STRIDE, type StepAccelerator } from './physics';

export interface WasmExports {
  memory: WebAssembly.Memory;
  step(ptr: number, count: number, na: number, g: number, dt: number, soft: number, maxv: number): void;
  hash01(i: number, seed: number): number;
  stride(): number;
}

export interface Kernel {
  accelerator: StepAccelerator;
  hash01: (i: number, seed: number) => number;
  name: 'wasm' | 'ts';
  stride: number;
}

/** Wrap an already-instantiated module. Exported so tests can load bytes from disk. */
export function createWasmAccelerator(ex: WasmExports): StepAccelerator {
  let view: Float32Array | null = null;
  let viewBytes = 0;

  function ensure(floats: number): { view: Float32Array; base: number } {
    const needed = floats * 4;
    if (needed > ex.memory.buffer.byteLength) {
      const pages = Math.ceil((needed - ex.memory.buffer.byteLength) / 65536) + 1;
      ex.memory.grow(pages);
      view = null; // buffer detached on grow
    }
    if (!view || viewBytes !== ex.memory.buffer.byteLength) {
      view = new Float32Array(ex.memory.buffer);
      viewBytes = ex.memory.buffer.byteLength;
    }
    return { view, base: 0 };
  }

  return {
    name: 'wasm',
    step(data, count, na, g, dt, soft, maxv) {
      const floats = count * STRIDE;
      const { view: v } = ensure(floats);
      v.set(data.subarray(0, floats), 0);
      ex.step(0, count, na, g, dt, soft, maxv);
      // Rebuild if a grow happened inside step (defensive; current kernel does not grow).
      if (v.byteLength !== ex.memory.buffer.byteLength) {
        const fresh = new Float32Array(ex.memory.buffer);
        data.set(fresh.subarray(0, floats), 0);
      } else {
        data.set(v.subarray(0, floats), 0);
      }
    },
  };
}

/** Load and validate the shipped module. Returns null on any failure. */
export async function loadWasmKernel(url?: string): Promise<WasmExports | null> {
  const target = url ?? `${import.meta.env.BASE_URL}wasm/orrery/cosmos_kernel.wasm`;
  try {
    const res = await fetch(target);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 256_000) return null;
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const ex = instance.exports as unknown as Partial<WasmExports>;
    if (
      !(ex.memory instanceof WebAssembly.Memory) ||
      typeof ex.step !== 'function' ||
      typeof ex.hash01 !== 'function' ||
      typeof ex.stride !== 'function' ||
      ex.stride() !== STRIDE
    ) {
      return null;
    }
    // Sanity-check the hash export against the reference before trusting it.
    const probe = (ex.hash01 as WasmExports['hash01'])(1, 2);
    if (!Number.isFinite(probe) || Math.abs(probe - tsHash01(1, 2)) > 1e-5) return null;
    return ex as WasmExports;
  } catch {
    return null;
  }
}

export const tsKernel: Kernel = {
  accelerator: { name: 'ts', step: stepReference },
  hash01: tsHash01,
  name: 'ts',
  stride: STRIDE,
};

export async function resolveKernel(url?: string): Promise<Kernel> {
  const ex = await loadWasmKernel(url);
  if (!ex) return tsKernel;
  return {
    accelerator: createWasmAccelerator(ex),
    hash01: (i, seed) => ex.hash01(i, seed),
    name: 'wasm',
    stride: ex.stride(),
  };
}
