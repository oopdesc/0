/**
 * Deterministic pseudo-random numbers.
 *
 * Every procedural universe in ORRERY is generated from a seed. The same seed
 * always produces the same sky, which matters for two reasons:
 *   1. A learner's mistake is reproducible (predict -> execute -> explain).
 *   2. Unit tests can assert exact values rather than fuzzy ranges.
 *
 * This is a toy generator (mulberry32 / splitmix32), NOT a cryptographic RNG.
 */

export function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next01: () => number;

  constructor(seed: number) {
    this.next01 = splitmix32(seed);
  }

  next(): number {
    return this.next01();
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive) >>> 0;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }

  /** Box-Muller, deterministic given the same call sequence. */
  gaussian(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

/** Integer hash used by BOTH the TypeScript fallback and the WASM kernel. */
export function hash01(i: number, seed: number): number {
  let x = (Math.imul(i ^ seed, 0x27d4eb2d) ^ 0x85ebca6b) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
