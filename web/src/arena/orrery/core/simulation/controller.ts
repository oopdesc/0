/**
 * One shared universe for the whole app. It owns the RAF loop, the WASM/TS
 * kernel, the camera and all lifecycle cleanup. React only subscribes to a
 * version counter, so the 60fps loop never re-renders the component tree.
 */
import {
  createWorld, applyPreset, copyWorld, MAX_BODIES, type PresetId, type WorldState, type Body,
} from '../world';
import { stepWorld, fingerprint } from '../physics';
import { resolveKernel, tsKernel, type Kernel } from '../wasmKernel';
import { executeSource, type ExecuteOutcome, type Dialect } from '../lang';
import { clamp } from '../rng';
import {
  UniverseRenderer, worldToScreen, type Camera, type RenderOptions,
} from './renderer';
import type { Quality } from '../progress/store';

export interface SimOptions {
  paused: boolean;
  timeScale: number;
  quality: Quality;
  trails: boolean;
  showGrid: boolean;
  reducedMotion: boolean;
  compare: boolean;
}

export interface SimStats {
  fps: number;
  bodies: number;
  kernelName: 'wasm' | 'ts';
  running: boolean;
  visible: boolean;
  preset: PresetId;
}

const TARGET_FPS: Record<Exclude<Quality, 'auto'>, number> = {
  high: 60, balanced: 45, battery: 24,
};

function detectAutoQuality(): number {
  if (typeof navigator === 'undefined') return 45;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 700;
  if (cores <= 4 || mem <= 2 || small) return 30;
  if (cores >= 8 && mem >= 8) return 60;
  return 45;
}

class UniverseController {
  world: WorldState = createWorld();
  kernel: Kernel = tsKernel;
  camera: Camera = { x: 0, y: 0, zoom: 1, rotation: 0 };
  options: SimOptions = {
    paused: false, timeScale: 1, quality: 'auto', trails: true,
    showGrid: true, reducedMotion: false, compare: false,
  };
  selectedId: number | null = null;
  hoveredId: number | null = null;
  fps = 0;
  version = 0;
  compareSnapshot: { world: WorldState; fp: number } | null = null;
  private kernelReady: Promise<void> | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private renderer: UniverseRenderer | null = null;
  private raf = 0;
  private last = 0;
  private lastRender = 0;
  private frameCounter = 0;
  private fpsWindow = 0;
  private hidden = false;
  private visible = true;
  private listeners = new Set<() => void>();
  private cleanup: Array<() => void> = [];

  constructor() {
    applyPreset(this.world, 'solar');
  }

  // ---- subscription ------------------------------------------------------

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): number => this.version;

  notify(): void {
    this.version++;
    for (const cb of this.listeners) cb();
    if (this.options.paused || !this.running) this.renderOnce();
  }

  private get running(): boolean {
    return !this.options.paused && !this.hidden && this.visible && this.canvas !== null;
  }

  // ---- kernel ------------------------------------------------------------

  initKernel(): void {
    if (this.kernelReady) return;
    this.kernelReady = resolveKernel()
      .then((k) => { this.kernel = k; this.notify(); })
      .catch(() => { this.kernel = tsKernel; });
  }

  // ---- lifecycle ---------------------------------------------------------

  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.detachAll();
    this.canvas = canvas;
    try {
      this.renderer = new UniverseRenderer(canvas);
    } catch {
      this.renderer = null;
    }
    this.initKernel();

    const parent = canvas.parentElement ?? canvas;
    const resize = () => this.resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(parent);
    if (typeof window !== 'undefined') window.addEventListener('resize', resize);
    this.cleanup.push(() => { ro?.disconnect(); window.removeEventListener('resize', resize); });

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        this.syncLoop();
      }, { threshold: 0.01 });
      io.observe(canvas);
    }
    this.cleanup.push(() => io?.disconnect());

    const onVisibility = () => {
      this.hidden = typeof document !== 'undefined' && document.hidden;
      this.syncLoop();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
    this.hidden = typeof document !== 'undefined' && document.hidden;

    const onContextLost = (e: Event) => { e.preventDefault(); this.stopLoop(); };
    const onContextRestored = () => {
      try { this.renderer = new UniverseRenderer(canvas); this.resize(); this.syncLoop(); } catch { /* fallback: app stays usable */ }
    };
    canvas.addEventListener('contextlost', onContextLost);
    canvas.addEventListener('contextrestored', onContextRestored);
    this.cleanup.push(() => {
      canvas.removeEventListener('contextlost', onContextLost);
      canvas.removeEventListener('contextrestored', onContextRestored);
    });

    this.resize();
    this.syncLoop();
  }

  detach(canvas: HTMLCanvasElement): void {
    if (this.canvas !== canvas) return;
    this.detachAll();
  }

  private detachAll(): void {
    this.stopLoop();
    for (const fn of this.cleanup.splice(0)) fn();
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas = null;
    this.visible = true;
  }

  private resize(): void {
    if (!this.canvas || !this.renderer) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth || 640;
    const h = rect.height || this.canvas.clientHeight || 420;
    const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = this.options.quality === 'high' ? 2 : this.options.quality === 'battery' ? 1 : 1.6;
    this.renderer.resize(w, h, Math.min(raw, cap), this.world.seed);
    this.renderOnce();
  }

  private targetFps(): number {
    if (this.options.quality === 'auto') return detectAutoQuality();
    return TARGET_FPS[this.options.quality];
  }

  private syncLoop(): void {
    if (this.running) {
      if (!this.raf) {
        this.last = 0;
        this.lastRender = 0;
        this.raf = requestAnimationFrame(this.frame);
      }
    } else {
      this.stopLoop();
      this.renderOnce();
    }
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.fps = 0;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (!this.running) { this.renderOnce(); return; }
    const interval = 1000 / this.targetFps();
    if (now - this.lastRender >= interval - 1) {
      const dt = this.last === 0 ? 1 / 60 : Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.lastRender = now;
      stepWorld(this.world, dt, this.kernel.accelerator);
      this.renderOnce();
      this.frameCounter++;
    }
    if (now - this.fpsWindow >= 1000) {
      this.fps = Math.round((this.frameCounter * 1000) / Math.max(1, now - this.fpsWindow));
      this.frameCounter = 0;
      this.fpsWindow = now;
      this.version++;
      for (const cb of this.listeners) cb();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private renderOnce(): void {
    if (!this.renderer || !this.canvas) return;
    const opts: RenderOptions & { ghost?: Body[] } = {
      grid: this.options.showGrid,
      trails: this.options.trails,
      background: this.world.background,
      selectedId: this.selectedId,
      hoveredId: this.hoveredId,
      compare: this.options.compare,
      compareFingerprint: this.compareSnapshot?.fp ?? null,
      reducedMotion: this.options.reducedMotion,
      ghost: this.options.compare ? this.compareSnapshot?.world.bodies : undefined,
    };
    try {
      this.renderer.render(this.world, this.camera, opts);
    } catch {
      // A single bad frame must never take down the app.
    }
  }

  // ---- commands ----------------------------------------------------------

  getStats(): SimStats {
    return {
      fps: this.fps,
      bodies: this.world.bodies.length,
      kernelName: this.kernel.name,
      running: this.running,
      visible: this.visible && !this.hidden,
      preset: this.world.preset,
    };
  }

  setPreset(preset: PresetId): void {
    applyPreset(this.world, preset);
    this.selectedId = null;
    this.camera = { x: 0, y: 0, zoom: preset === 'spiral' ? 0.85 : 1, rotation: 0 };
    this.options.timeScale = 1;
    this.notify();
  }

  setPaused(paused: boolean): void {
    this.options.paused = paused;
    this.syncLoop();
    this.notify();
  }

  togglePaused(): void { this.setPaused(!this.options.paused); }

  setTimeScale(t: number): void {
    this.world.timeScale = clamp(t, 0.1, 4);
    this.options.timeScale = this.world.timeScale;
    this.notify();
  }

  setGravity(g: number): void {
    this.world.gravity = clamp(g, 0, 10);
    this.notify();
  }

  setQuality(q: Quality): void {
    this.options.quality = q;
    this.resize();
    this.notify();
  }

  setTrails(on: boolean): void { this.options.trails = on; this.world.trails = on; this.notify(); }
  setGrid(on: boolean): void { this.options.showGrid = on; this.notify(); }
  setReducedMotion(on: boolean): void {
    this.options.reducedMotion = on;
    if (on) this.setPaused(true);
    else this.setPaused(false);
    this.notify();
  }

  zoomBy(factor: number): void {
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.18, 6);
    this.notify();
  }

  rotateBy(rad: number): void {
    this.camera.rotation += rad;
    this.notify();
  }

  panBy(dxScreen: number, dyScreen: number): void {
    const { w, h } = this.renderer?.size ?? { w: 640, h: 420, dpr: 1 };
    const c = Math.cos(this.camera.rotation);
    const s = Math.sin(this.camera.rotation);
    const rx = dxScreen / this.camera.zoom;
    const ry = dyScreen / this.camera.zoom;
    this.camera.x -= (rx * c + ry * s);
    this.camera.y -= (-rx * s + ry * c);
    void w; void h;
    this.notify();
  }

  resetView(): void {
    this.camera = { x: 0, y: 0, zoom: this.world.preset === 'spiral' ? 0.85 : 1, rotation: 0 };
    this.selectedId = null;
    this.notify();
  }

  focusSelected(): void {
    const b = this.world.bodies.find((x) => x.id === this.selectedId);
    if (!b) return;
    this.camera.x = b.x;
    this.camera.y = b.y;
    this.camera.zoom = clamp(this.camera.zoom * 1.35, 0.18, 6);
    this.notify();
  }

  hitTest(sx: number, sy: number): Body | null {
    const { w, h } = this.renderer?.size ?? { w: 640, h: 420, dpr: 1 };
    let best: Body | null = null;
    let bestDist = 18;
    for (const b of this.world.bodies) {
      const [bx, by] = worldToScreen(b.x, b.y, this.camera, w, h);
      const d = Math.hypot(bx - sx, by - sy);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  selectAt(sx: number, sy: number): Body | null {
    const b = this.hitTest(sx, sy);
    this.selectedId = b?.id ?? null;
    this.notify();
    return b;
  }

  snapshot(): number {
    this.compareSnapshot = { world: copyWorld(this.world), fp: fingerprint(this.world) };
    this.options.compare = true;
    this.notify();
    return this.compareSnapshot.fp;
  }

  clearSnapshot(): void {
    this.compareSnapshot = null;
    this.options.compare = false;
    this.notify();
  }

  /** Execute learner code against the live universe. */
  runSource(source: string, dialect: Dialect, checkBorrows = false): ExecuteOutcome {
    const outcome = executeSource(source, {
      dialect, world: this.world, checkBorrows,
      hash01: (i, seed) => this.kernel.hash01(i, seed),
    });
    this.notify();
    return outcome;
  }

  resetWorld(): void {
    this.setPreset('solar');
  }

  get selectedBody(): Body | null {
    return this.world.bodies.find((b) => b.id === this.selectedId) ?? null;
  }

  get maxBodies(): number { return MAX_BODIES; }
}

export const universe = new UniverseController();
