/**
 * Deterministic simulation step.
 *
 * All numeric work is pure and lives here, never in React or in the renderer.
 * The same function is implemented three times on purpose:
 *   1. `stepReference` below (TypeScript, f64) — the specification + fallback.
 *   2. `wasm/cosmos_kernel.wat` (WASM, f32) — fast path shipped to browsers.
 *   3. `rust/src/lib.rs` (Rust, f32) — canonical, human-maintained source.
 * Tests assert they agree. Values are compared with a small tolerance because
 * WASM/Rust use f32 while JavaScript uses f64.
 */
import type { WorldState } from './world';

export const STRIDE = 8;
export const SOFTENING = 8;
export const MAX_SPEED = 380;
/** Only the closest few attractors are used; keeps O(n * k) small on phones. */
export const MAX_ATTRACTORS = 24;

export interface StepAccelerator {
  readonly name: 'wasm' | 'ts';
  step(
    data: Float32Array,
    count: number,
    na: number,
    g: number,
    dt: number,
    soft: number,
    maxv: number,
  ): void;
}

/** Reference specification. No DOM, no randomness, no mutation outside `data`. */
export function stepReference(
  data: Float32Array,
  count: number,
  na: number,
  g: number,
  dt: number,
  soft: number,
  maxv: number,
): void {
  if (count <= 0 || na <= 0 || dt === 0) return;
  const soft2 = soft * soft;
  const maxv2 = maxv * maxv;
  const k = Math.min(na, count);
  for (let i = 0; i < count; i++) {
    const bi = i * STRIDE;
    if (data[bi + 6] !== 0) continue; // fixed attractor / static artwork
    let x = data[bi];
    let y = data[bi + 1];
    let vx = data[bi + 2];
    let vy = data[bi + 3];
    let ax = 0;
    let ay = 0;
    for (let j = 0; j < k; j++) {
      const bj = j * STRIDE;
      const dx = data[bj] - x;
      const dy = data[bj + 1] - y;
      const r2 = dx * dx + dy * dy + soft2;
      const f = (g * data[bj + 4]) / (r2 * Math.sqrt(r2));
      ax += dx * f;
      ay += dy * f;
    }
    vx += ax * dt;
    vy += ay * dt;
    const sp2 = vx * vx + vy * vy;
    if (sp2 > maxv2) {
      const scale = maxv / Math.sqrt(sp2);
      vx *= scale;
      vy *= scale;
    }
    x += vx * dt;
    y += vy * dt;
    data[bi] = x;
    data[bi + 1] = y;
    data[bi + 2] = vx;
    data[bi + 3] = vy;
  }
}

export const tsAccelerator: StepAccelerator = {
  name: 'ts',
  step: stepReference,
};

export interface PackedWorld {
  count: number;
  na: number;
  /** packedIndex -> index into world.bodies */
  order: number[];
}

/** Pack the world into the flat ABI buffer: attractors first, then movers. */
export function packWorld(world: WorldState, data: Float32Array): PackedWorld {
  const fixed: number[] = [];
  const movers: number[] = [];
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (b.orbit) continue; // analytic orbits are stepped separately
    if (b.fixed) fixed.push(i);
    else movers.push(i);
  }
  const na = Math.min(fixed.length, MAX_ATTRACTORS);
  const chosen = fixed.slice(0, na).concat(movers);
  const order: number[] = [];
  for (let p = 0; p < chosen.length; p++) {
    const idx = chosen[p];
    const b = world.bodies[idx];
    const o = p * STRIDE;
    data[o] = b.x;
    data[o + 1] = b.y;
    data[o + 2] = b.vx;
    data[o + 3] = b.vy;
    data[o + 4] = b.mass;
    data[o + 5] = b.radius;
    data[o + 6] = p < na ? 1 : 0;
    data[o + 7] = b.glow;
    order.push(idx);
  }
  return { count: chosen.length, na, order };
}

export function unpackWorld(world: WorldState, data: Float32Array, packed: PackedWorld): void {
  for (let p = packed.na; p < packed.count; p++) {
    const b = world.bodies[packed.order[p]];
    const o = p * STRIDE;
    b.x = data[o];
    b.y = data[o + 1];
    b.vx = data[o + 2];
    b.vy = data[o + 3];
  }
}

/** Analytic elliptical motion. Clearly labelled as an educational orbit model. */
export function stepOrbits(world: WorldState, dt: number): void {
  for (const b of world.bodies) {
    const o = b.orbit;
    if (!o) continue;
    o.phase += o.speed * dt;
    const e = Math.max(0, Math.min(0.85, o.eccentricity));
    const minor = o.radius * Math.sqrt(1 - e * e);
    b.x = o.cx + o.radius * (Math.cos(o.phase) - e);
    b.y = o.cy + minor * Math.sin(o.phase);
  }
}

let scratch = new Float32Array(0);

function ensureScratch(floats: number): Float32Array {
  if (scratch.length < floats) {
    scratch = new Float32Array(Math.max(floats, 256));
  }
  return scratch;
}

/** Advance the world by `dtSeconds` of wall time (clamped, scaled by timeScale). */
export function stepWorld(world: WorldState, dtSeconds: number, accel: StepAccelerator = tsAccelerator): void {
  const dt = Math.min(0.05, Math.max(0, dtSeconds)) * world.timeScale;
  if (dt <= 0) return;
  stepOrbits(world, dt);
  if (world.bodies.length === 0) return;
  const data = ensureScratch(world.bodies.length * STRIDE);
  const packed = packWorld(world, data);
  if (packed.count === 0 || packed.na === 0) return;
  accel.step(data, packed.count, packed.na, world.gravity, dt, SOFTENING, MAX_SPEED);
  unpackWorld(world, data, packed);
}

/** Used by tests and by the deterministic "compare" feature. */
export function fingerprint(world: WorldState): number {
  let h = 2166136261 >>> 0;
  for (const b of world.bodies) {
    for (const v of [b.x, b.y, b.vx, b.vy, b.mass]) {
      h ^= Math.round(v * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h >>> 0;
}
