/**
 * Procedural Canvas 2D renderer. No external images, no video, no WebGL
 * requirement. Everything is generated from a deterministic seed, so a
 * screenshot is reproducible.
 *
 * Layers:
 *   bg    — pre-rendered once per resize: nebula, distant stars, vignette
 *   trail — persistent fading buffer (only when trails are enabled)
 *   main  — grid, analytic orbits, trail composite, bodies, labels
 *
 * The renderer NEVER mutates the world. All math is here or in physics.ts.
 */
import { Rng, clamp, hash01 } from '../rng';
import type { WorldState, Body } from '../world';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface RenderOptions {
  grid: boolean;
  trails: boolean;
  background: string;
  selectedId: number | null;
  hoveredId: number | null;
  compare: boolean;
  compareFingerprint: number | null;
  reducedMotion: boolean;
  /** Faint positions from a saved "compare" snapshot. */
  ghost?: Body[];
}

export function worldToScreen(x: number, y: number, cam: Camera, w: number, h: number): [number, number] {
  const c = Math.cos(cam.rotation);
  const s = Math.sin(cam.rotation);
  const dx = x - cam.x;
  const dy = y - cam.y;
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  return [w / 2 + rx * cam.zoom, h / 2 + ry * cam.zoom];
}

export function screenToWorld(sx: number, sy: number, cam: Camera, w: number, h: number): [number, number] {
  const c = Math.cos(cam.rotation);
  const s = Math.sin(cam.rotation);
  const rx = (sx - w / 2) / cam.zoom;
  const ry = (sy - h / 2) / cam.zoom;
  return [cam.x + rx * c + ry * s, cam.y - rx * s + ry * c];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  return c;
}

export class UniverseRenderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private trail: HTMLCanvasElement | null = null;
  private trailCtx: CanvasRenderingContext2D | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private bgSeed = -1;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D を利用できません');
    this.ctx = ctx;
  }

  get size(): { w: number; h: number; dpr: number } {
    return { w: this.w, h: this.h, dpr: this.dpr };
  }

  resize(cssW: number, cssH: number, dpr: number, seed: number): void {
    if (this.disposed) return;
    const w = Math.max(1, Math.floor(cssW));
    const h = Math.max(1, Math.floor(cssH));
    const nextDpr = clamp(dpr, 1, 2.5);
    if (w === this.w && h === this.h && nextDpr === this.dpr && seed === this.bgSeed) return;
    this.w = w;
    this.h = h;
    this.dpr = nextDpr;
    this.canvas.width = Math.floor(w * nextDpr);
    this.canvas.height = Math.floor(h * nextDpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.bg = makeCanvas(w * nextDpr, h * nextDpr);
    this.bgCtx = this.bg.getContext('2d');
    this.trail = makeCanvas(w * nextDpr, h * nextDpr);
    this.trailCtx = this.trail.getContext('2d');
    this.bgSeed = seed;
    this.buildBackground(seed);
  }

  private buildBackground(seed: number): void {
    const ctx = this.bgCtx;
    if (!ctx) return;
    const W = this.w * this.dpr;
    const H = this.h * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, W, H);

    // Low-frequency nebula: a handful of large, very faint radial gradients.
    const rng = new Rng(seed ^ 0x51f0a7);
    ctx.globalCompositeOperation = 'lighter';
    const tints = [
      [70, 92, 112], [96, 74, 88], [58, 98, 106], [92, 84, 66],
    ] as const;
    for (let i = 0; i < 9; i++) {
      const cx = rng.range(-0.1, 1.1) * W;
      const cy = rng.range(-0.1, 1.1) * H;
      const r = rng.range(0.18, 0.72) * Math.max(W, H);
      const tint = tints[i % tints.length]!;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.075 + rng.next() * 0.055).toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${tint[0]},${tint[1]},${tint[2]},0.022)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Distant stars, deterministic and fixed to the viewport (parallax-free).
    const count = Math.min(520, Math.floor((W * H) / 5200));
    for (let i = 0; i < count; i++) {
      const x = hash01(i * 3 + 1, seed) * W;
      const y = hash01(i * 3 + 2, seed ^ 0x9e37) * H;
      const a = 0.08 + hash01(i * 3 + 3, seed) * 0.42;
      const r = hash01(i + 77, seed ^ 0x1234) > 0.97 ? 1.5 : 0.65;
      ctx.fillStyle = `rgba(214,228,236,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Vignette keeps text readable over the art.
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(2,4,7,0.62)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  render(world: WorldState, cam: Camera, opts: RenderOptions): void {
    if (this.disposed) return;
    const ctx = this.ctx;
    const d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);

    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawGrid(ctx, cam, opts.grid);
    this.drawOrbitRings(ctx, world, cam);

    // Trail buffer lives in world space with the same camera transform.
    const tctx = this.trailCtx;
    if (tctx && this.trail) {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      if (opts.trails && !opts.reducedMotion) {
        tctx.fillStyle = 'rgba(8,11,16,0.16)';
        tctx.fillRect(0, 0, this.trail.width, this.trail.height);
      } else {
        tctx.clearRect(0, 0, this.trail.width, this.trail.height);
      }
      if (opts.trails && !opts.reducedMotion) {
        tctx.setTransform(d, 0, 0, d, 0, 0);
        tctx.translate(this.w / 2, this.h / 2);
        tctx.scale(cam.zoom, cam.zoom);
        tctx.rotate(cam.rotation);
        tctx.translate(-cam.x, -cam.y);
        for (const b of world.bodies) {
          if (b.fixed || b.kind === 'dust') continue;
          tctx.fillStyle = b.color;
          tctx.globalAlpha = 0.28;
          tctx.beginPath();
          tctx.arc(b.x, b.y, Math.max(0.6, b.radius * 0.42), 0, Math.PI * 2);
          tctx.fill();
        }
        tctx.globalAlpha = 1;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.trail, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.rotate(cam.rotation);
    ctx.translate(-cam.x, -cam.y);
    this.drawGhost(ctx, opts.ghost);
    this.drawBodies(ctx, world, cam, opts);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawOverlay(ctx, world, cam, opts);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, show: boolean): void {
    if (!show) return;
    const [cx, cy] = worldToScreen(0, 0, cam, this.w, this.h);
    ctx.save();
    ctx.strokeStyle = 'rgba(150,178,192,0.085)';
    ctx.lineWidth = 1;
    for (let r = 60; r <= 360; r += 60) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,178,192,0.055)';
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2 + cam.rotation;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * 1000, cy + Math.sin(ang) * 1000);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawOrbitRings(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera): void {
    const seen = new Set<string>();
    ctx.save();
    ctx.strokeStyle = 'rgba(170,196,208,0.10)';
    ctx.lineWidth = 1;
    for (const b of world.bodies) {
      if (!b.orbit) continue;
      const key = `${b.orbit.cx}:${b.orbit.cy}:${b.orbit.radius}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [cx, cy] = worldToScreen(b.orbit.cx, b.orbit.cy, cam, this.w, this.h);
      const minor = b.orbit.radius * Math.sqrt(1 - b.orbit.eccentricity ** 2) * cam.zoom;
      const major = b.orbit.radius * cam.zoom;
      ctx.beginPath();
      ctx.ellipse(cx, cy, major, minor, cam.rotation, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, ghost: Body[] | undefined): void {
    if (!ghost || ghost.length === 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(242,179,107,0.42)';
    ctx.lineWidth = 1;
    const stride = Math.max(1, Math.floor(ghost.length / 500));
    for (let i = 0; i < ghost.length; i += stride) {
      const b = ghost[i]!;
      const r = Math.max(1.6, b.radius);
      ctx.beginPath();
      ctx.moveTo(b.x - r, b.y);
      ctx.lineTo(b.x + r, b.y);
      ctx.moveTo(b.x, b.y - r);
      ctx.lineTo(b.x, b.y + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBodies(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, opts: RenderOptions): void {
    // Small points first (cheap), bright stars last.
    const points: Body[] = [];
    const discs: Body[] = [];
    const stars: Body[] = [];
    for (const b of world.bodies) {
      if (b.kind === 'dust' || b.kind === 'star' || b.kind === 'particle' || b.kind === 'moon') points.push(b);
      else if (b.kind === 'attractor') stars.push(b);
      else discs.push(b);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const b of points) {
      const r = Math.max(0.55, Math.min(4.2, b.radius * 1.05));
      ctx.globalAlpha = Math.max(0.18, Math.min(1, b.glow));
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    for (const b of stars) {
      const R = Math.max(6, b.radius);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 4.2);
      g.addColorStop(0, 'rgba(255,246,224,0.95)');
      g.addColorStop(0.12, b.color);
      g.addColorStop(0.42, hexAlpha(b.color, 0.16));
      g.addColorStop(1, hexAlpha(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R * 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(2.2, R * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of discs) {
      const r = Math.max(1.6, b.radius);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(b.x - r * 0.28, b.y - r * 0.3, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,10,14,0.5)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (opts.selectedId !== null || opts.hoveredId !== null) {
      const b = world.bodies.find((x) => x.id === (opts.selectedId ?? opts.hoveredId));
      if (b) {
        const r = Math.max(8, b.radius * 2.4);
        ctx.strokeStyle = opts.selectedId === b.id ? 'rgba(242,179,107,0.95)' : 'rgba(180,210,222,0.6)';
        ctx.lineWidth = 1.2 / Math.max(0.25, cam.zoom);
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x - r * 1.6, b.y); ctx.lineTo(b.x - r * 1.15, b.y);
        ctx.moveTo(b.x + r * 1.15, b.y); ctx.lineTo(b.x + r * 1.6, b.y);
        ctx.moveTo(b.x, b.y - r * 1.6); ctx.lineTo(b.x, b.y - r * 1.15);
        ctx.moveTo(b.x, b.y + r * 1.15); ctx.lineTo(b.x, b.y + r * 1.6);
        ctx.stroke();
      }
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, opts: RenderOptions): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    let drawn = 0;
    for (const b of world.bodies) {
      if (!b.label || drawn >= 14) continue;
      const [sx, sy] = worldToScreen(b.x, b.y, cam, this.w, this.h);
      if (sx < -40 || sy < -20 || sx > this.w + 40 || sy > this.h + 20) continue;
      ctx.fillStyle = 'rgba(226,236,240,0.75)';
      ctx.fillText(b.label, sx + 10, sy - 9);
      ctx.strokeStyle = 'rgba(226,236,240,0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy - 4);
      ctx.lineTo(sx + 8, sy - 8);
      ctx.stroke();
      drawn++;
    }
    if (opts.compare && opts.compareFingerprint !== null) {
      ctx.fillStyle = 'rgba(242,179,107,0.85)';
      ctx.fillText('COMPARE SNAPSHOT', 14, this.h - 18);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.bg = null;
    this.bgCtx = null;
    this.trail = null;
    this.trailCtx = null;
    void this.canvas;
  }
}

function hexAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return `rgba(200,215,225,${alpha})`;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(200,215,225,${alpha})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
