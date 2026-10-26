/**
 * The universe is plain data. No renderer, DOM or React lives in this module.
 * That separation is what makes the simulation deterministic and testable.
 */
import { Rng } from './rng';

export type BodyKind = 'star' | 'planet' | 'moon' | 'particle' | 'dust' | 'attractor';

export interface OrbitSpec {
  cx: number;
  cy: number;
  radius: number;
  phase: number;
  speed: number;
  /** 0 = circle, 0..0.9 = increasingly eccentric (educational parameterisation). */
  eccentricity: number;
}

export interface Body {
  id: number;
  kind: BodyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  /** Optional human label; also used as the accessible name. */
  label: string;
  /** Bodies with fixed=true are attractors and are never integrated. */
  fixed: boolean;
  /** True for the analytic-orbit preset; these bodies use Kepler-like motion. */
  orbit?: OrbitSpec;
  /** 0..1 brightness multiplier, used by the accretion disk / galaxy. */
  glow: number;
}

export type PresetId = 'solar' | 'spiral' | 'accretion' | 'asteroid' | 'empty';

export interface WorldState {
  bodies: Body[];
  gravity: number;
  timeScale: number;
  trails: boolean;
  background: string;
  seed: number;
  preset: PresetId;
  nextId: number;
}

export interface BodyInit {
  kind?: BodyKind;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  mass?: number;
  radius?: number;
  color?: string;
  label?: string;
  fixed?: boolean;
  orbit?: OrbitSpec;
  glow?: number;
}

export const PALETTE = {
  starWarm: '#f4c07a',
  starWhite: '#e8f1f2',
  starBlue: '#a9c9e8',
  planetTeal: '#79c7bd',
  planetRust: '#d98a63',
  planetBone: '#c8cfd2',
  dust: '#8fa8b8',
  accent: '#f2b36b',
} as const;

export function createWorld(seed = 20261026): WorldState {
  return {
    bodies: [],
    gravity: 1,
    timeScale: 1,
    trails: true,
    background: '#080b10',
    seed,
    preset: 'empty',
    nextId: 1,
  };
}

export function addBody(world: WorldState, init: BodyInit = {}): Body {
  const body: Body = {
    id: world.nextId++,
    kind: init.kind ?? 'planet',
    x: init.x ?? 0,
    y: init.y ?? 0,
    vx: init.vx ?? 0,
    vy: init.vy ?? 0,
    mass: init.mass ?? 1,
    radius: init.radius ?? 3,
    color: init.color ?? PALETTE.planetTeal,
    label: init.label ?? '',
    fixed: init.fixed ?? false,
    ...(init.orbit ? { orbit: { ...init.orbit } } : {}),
    glow: init.glow ?? 1,
  };
  world.bodies.push(body);
  return body;
}

export function clearWorld(world: WorldState): void {
  world.bodies.length = 0;
  world.nextId = 1;
}

export function copyWorld(world: WorldState): WorldState {
  return {
    ...world,
    bodies: world.bodies.map((b) => ({ ...b, ...(b.orbit ? { orbit: { ...b.orbit } } : {}) })),
  };
}

/** Hard bound. A learner can write `spiral(999999)` and the app must survive. */
export const MAX_BODIES = 2400;

export function canAdd(world: WorldState, n: number): number {
  return Math.max(0, Math.min(Math.floor(n) || 0, MAX_BODIES - world.bodies.length));
}

/** Cosmos API used by the code interpreter. All arguments are clamped. */
export interface CosmosApi {
  clear(): void;
  star(x: number, y: number, mass: number, color?: string, label?: string): Body;
  planet(x: number, y: number, radius: number, color?: string, label?: string, vx?: number, vy?: number): Body;
  particle(x: number, y: number, vx: number, vy: number, color?: string, size?: number): Body | null;
  orbit(cx: number, cy: number, radius: number, count: number, speed?: number, color?: string, eccentricity?: number): number;
  spiral(arms: number, count: number, radius: number, spin?: number, color?: string): number;
  dust(count: number, radius: number, color?: string): number;
  gravity(g: number): void;
  timeScale(t: number): void;
  trails(on: boolean): void;
  background(hex: string): void;
}

function safeNumber(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

/** Reject anything that is not a simple hex colour or a short known name. */
export function safeColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) || /^[a-zA-Z]{3,18}$/.test(v)
    ? v
    : fallback;
}

export function makeCosmosApi(world: WorldState): CosmosApi {
  const rng = new Rng(world.seed);

  return {
    clear() {
      clearWorld(world);
      world.preset = 'empty';
    },
    star(x, y, mass, color, label) {
      const n = canAdd(world, 1);
      if (n === 0) return world.bodies[world.bodies.length - 1] as Body;
      const m = safeNumber(mass, 1200, 1, 100000);
      return addBody(world, {
        kind: 'attractor',
        x: safeNumber(x, 0, -2000, 2000),
        y: safeNumber(y, 0, -2000, 2000),
        mass: m,
        radius: Math.max(4, Math.cbrt(m) * 1.5),
        color: safeColor(color, PALETTE.starWarm),
        label: typeof label === 'string' ? label.slice(0, 40) : 'Star',
        fixed: true,
        glow: 1,
      });
    },
    planet(x, y, radius, color, label, vx, vy) {
      const n = canAdd(world, 1);
      if (n === 0) return world.bodies[world.bodies.length - 1] as Body;
      return addBody(world, {
        kind: 'planet',
        x: safeNumber(x, 0, -2000, 2000),
        y: safeNumber(y, 0, -2000, 2000),
        vx: safeNumber(vx, 0, -300, 300),
        vy: safeNumber(vy, 0, -300, 300),
        radius: safeNumber(radius, 4, 0.5, 60),
        color: safeColor(color, PALETTE.planetTeal),
        label: typeof label === 'string' ? label.slice(0, 40) : '',
        mass: Math.max(1, safeNumber(radius, 4, 0.5, 60) ** 3),
      });
    },
    particle(x, y, vx, vy, color, size) {
      if (canAdd(world, 1) === 0) return null;
      return addBody(world, {
        kind: 'particle',
        x: safeNumber(x, 0, -3000, 3000),
        y: safeNumber(y, 0, -3000, 3000),
        vx: safeNumber(vx, 0, -400, 400),
        vy: safeNumber(vy, 0, -400, 400),
        radius: safeNumber(size, 1.4, 0.3, 8),
        color: safeColor(color, PALETTE.starWhite),
        mass: 1,
      });
    },
    orbit(cx, cy, radius, count, speed, color, eccentricity) {
      const c = canAdd(world, safeNumber(count, 6, 0, 1200));
      const r = safeNumber(radius, 80, 1, 1500);
      const s = safeNumber(speed, 0.6, -8, 8);
      const e = safeNumber(eccentricity, 0, 0, 0.85);
      const col = safeColor(color, PALETTE.planetBone);
      for (let i = 0; i < c; i++) {
        addBody(world, {
          kind: 'moon',
          x: cx + r,
          y: cy,
          radius: 2.2,
          mass: 1,
          color: col,
          label: '',
          orbit: { cx, cy, radius: r, phase: (i / c) * Math.PI * 2, speed: s, eccentricity: e },
          glow: 0.9,
        });
      }
      world.preset = 'empty';
      return c;
    },
    spiral(arms, count, radius, spin, color) {
      const a = Math.max(1, Math.min(12, Math.floor(safeNumber(arms, 3, 1, 12))));
      const c = canAdd(world, safeNumber(count, 480, 0, 2000));
      const rMax = safeNumber(radius, 220, 10, 1200);
      const spinAmount = safeNumber(spin, 2.4, 0, 12);
      const col = safeColor(color, PALETTE.starBlue);
      for (let i = 0; i < c; i++) {
        const t = Math.pow((i + 0.5) / Math.max(1, c), 0.62);
        const arm = i % a;
        const angle = (arm / a) * Math.PI * 2 + t * spinAmount + rng.gaussian() * 0.16;
        const jitter = rng.gaussian() * (0.035 + t * 0.1) * rMax;
        const r = t * rMax + jitter;
        addBody(world, {
          kind: 'star',
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r * 0.82,
          radius: 0.7 + rng.next() * 1.5,
          mass: 1,
          color: i % 9 === 0 ? PALETTE.accent : col,
          label: '',
          fixed: true,
          glow: 0.45 + rng.next() * 0.55,
        });
      }
      world.preset = 'spiral';
      return c;
    },
    dust(count, radius, color) {
      const c = canAdd(world, safeNumber(count, 200, 0, 2000));
      const r = safeNumber(radius, 180, 1, 1400);
      const col = safeColor(color, PALETTE.dust);
      for (let i = 0; i < c; i++) {
        const angle = rng.next() * Math.PI * 2;
        const rr = r * Math.sqrt(rng.next());
        addBody(world, {
          kind: 'dust',
          x: Math.cos(angle) * rr,
          y: Math.sin(angle) * rr,
          vx: 0,
          vy: 0,
          radius: 0.6 + rng.next() * 1.1,
          mass: 1,
          color: col,
          label: '',
          fixed: true,
          glow: 0.3 + rng.next() * 0.5,
        });
      }
      return c;
    },
    gravity(g) {
      world.gravity = safeNumber(g, 1, 0, 50);
    },
    timeScale(t) {
      world.timeScale = safeNumber(t, 1, 0, 8);
    },
    trails(on) {
      world.trails = Boolean(on);
    },
    background(hex) {
      world.background = safeColor(hex, world.background);
    },
  };
}

/** Deep, hand-authored presets. These are teaching models, not observational data. */
export function applyPreset(world: WorldState, preset: PresetId): void {
  clearWorld(world);
  world.preset = preset;
  world.gravity = 1;
  world.timeScale = 1;
  const api = makeCosmosApi(world);

  if (preset === 'solar') {
    api.star(0, 0, 2600, PALETTE.starWarm, 'Sol');
    const planets: Array<[string, number, number, string, number]> = [
      ['Mercury', 62, 1.9, PALETTE.planetBone, 1.62],
      ['Venus', 92, 3.1, '#d8b98a', 1.18],
      ['Terra', 128, 3.4, PALETTE.planetTeal, 1.0],
      ['Mars', 166, 2.6, PALETTE.planetRust, 0.81],
      ['Jupiter', 226, 7.2, '#c9a17c', 0.44],
      ['Saturn', 292, 6.1, '#d6c69b', 0.33],
    ];
    planets.forEach(([label, r, size, color, speed], i) => {
      addBody(world, {
        kind: 'planet',
        x: r,
        y: 0,
        radius: size,
        mass: size ** 3,
        color,
        label,
        orbit: { cx: 0, cy: 0, radius: r, phase: i * 0.9, speed, eccentricity: 0.06 },
        glow: 1,
      });
    });
    api.orbit(226, 0, 13, 4, 1.4, '#b9b2a4', 0.1);
    world.bodies.slice(-4).forEach((b) => {
      b.orbit = { cx: 226, cy: 0, radius: 13, phase: b.orbit?.phase ?? 0, speed: 1.4, eccentricity: 0.1 };
    });
  } else if (preset === 'spiral') {
    api.star(0, 0, 900, PALETTE.accent, 'Core');
    api.spiral(3, 900, 250, 2.6, PALETTE.starBlue);
    api.dust(160, 300, '#5f7686');
  } else if (preset === 'accretion') {
    // Educational visualisation: NOT a general-relativistic ray trace.
    api.star(0, 0, 4000, '#05070b', 'Shadow');
    const ringColors = ['#f6d7a8', '#f2b36b', '#d9804f', '#a9c9e8'];
    for (let ring = 0; ring < 4; ring++) {
      const count = 150;
      const r = 62 + ring * 27;
      api.orbit(0, 0, r, count, 2.5 / (1 + ring * 0.7), ringColors[ring] as string, 0.12);
      world.bodies.slice(-count).forEach((b) => {
        b.kind = 'dust';
        b.radius = 1 + ring * 0.25;
        b.glow = 0.7 + (3 - ring) * 0.12;
      });
    }
    api.dust(180, 330, '#33414d');
  } else if (preset === 'asteroid') {
    api.star(0, 0, 2200, PALETTE.starWarm, 'Sol');
    api.orbit(0, 0, 190, 420, 0.55, PALETTE.planetBone, 0.14);
    world.bodies.slice(-420).forEach((b) => {
      b.kind = 'dust';
      b.radius = 0.8 + ((b.id * 37) % 13) / 10;
    });
    addBody(world, {
      kind: 'planet', x: 250, y: 0, radius: 6, mass: 220,
      color: PALETTE.planetTeal, label: 'Terra',
      orbit: { cx: 0, cy: 0, radius: 250, phase: 0, speed: 0.42, eccentricity: 0.04 },
      glow: 1,
    });
  }
}
