/**
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   https://github.com/ULuIQ12/webgpu-tsl-linkedparticles
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している（コピーではない）。
 *   クレジットの全文は THIRD_PARTY_NOTICES.md。
 */
/**
 * 宇宙ページの進行役。
 * - バックエンドの選択（WebGPU → WebGL2 → 静止画）
 * - Rust/wasm の粒子コアの読み込みと 1 フレームごとの更新
 * - ポインタ入力、可視状態、コンテキストロスト、動きの抑制、品質の自動調整
 *
 * 学習ページからは動的 import されるだけで、初期バンドルには入らない。
 */
import { createWebGL2 } from "./webgl2";
import { createWebGPU, type CursorState, type SpaceRenderer } from "./webgpu";
import { createStatic } from "./staticScene";
import {
  FrameMeter,
  degrade,
  preset,
  type Quality,
  type Tier,
} from "./quality";
import { loadSpaceCore, type SpaceCore } from "../engine/rust/spaceCore";

export interface EngineStats {
  backend: "webgpu" | "webgl2" | "static";
  tier: Tier;
  particles: number;
  links: number;
  fps: number;
  wasm: boolean;
}

export interface EngineHandle {
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
  stats(): EngineStats;
}

export async function createEngine(
  canvas: HTMLCanvasElement,
  opts: {
    tier: Tier;
    reducedMotion: boolean;
    onStats?: (s: EngineStats) => void;
    onDowngrade?: (next: Quality) => void;
  },
): Promise<EngineHandle> {
  const q = preset(opts.tier);
  let renderer: SpaceRenderer | null = null;

  if (!opts.reducedMotion) {
    renderer = await createWebGPU(canvas, q).catch(() => null);
    if (!renderer) {
      renderer = (() => {
        try {
          return createWebGL2(canvas, q);
        } catch {
          return null;
        }
      })();
    }
  }
  const staticOnly = !renderer;
  if (!renderer) renderer = createStatic(canvas);

  const core: SpaceCore | null = staticOnly ? null : await loadSpaceCore();
  const anchorCount = core ? Math.min(q.count, 1200) : 0;
  if (core) core.init(anchorCount, 20260901);

  const cursor: CursorState = { x: 0.5, y: 0.5, vx: 0, vy: 0, down: 0 };
  const meter = new FrameMeter();
  let raf = 0;
  let running = false;
  let last = 0;
  let t = 0;
  let slowFrames = 0;
  let downgraded = false;
  let visible = true;
  let disposed = false;
  let onScreen = true;

  const stats: EngineStats = {
    backend: renderer.backend,
    tier: q.tier,
    particles: anchorCount,
    links: 0,
    fps: 0,
    wasm: Boolean(core),
  };

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, q.dprCap);
    renderer!.resize(Math.max(1, rect.width), Math.max(1, rect.height), dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  function loop(now: number) {
    if (!running || disposed) return;
    // 動きを減らす設定では 1 枚だけ描いて止める（rAF を予約しない）
    if (opts.reducedMotion) {
      renderer!.frame(
        0,
        0,
        cursor,
        new Float32Array(0),
        0,
        new Float32Array(0),
        0,
      );
      running = false;
      return;
    }
    raf = requestAnimationFrame(loop);
    if (!last) last = now - 34;
    if (now - last < 1000 / 30) return;
    const dtMs = Math.min(64, now - last);
    last = now;
    meter.push(now);
    t += dtMs / 1000;

    if (core) {
      core.step(
        dtMs / 1000,
        cursor.x,
        1 - cursor.y,
        0.7 + cursor.down * 1.5,
        1,
        1,
      );
      const anchors = core.particles();
      const links = core.links();
      const nLinks = core.linkCount();
      stats.particles = core.count();
      stats.links = nLinks;
      renderer!.frame(
        t,
        dtMs / 1000,
        cursor,
        links,
        nLinks,
        anchors,
        core.count(),
      );
    } else {
      renderer!.frame(
        t,
        dtMs / 1000,
        cursor,
        new Float32Array(0),
        0,
        new Float32Array(0),
        0,
      );
    }

    // カーソル速度は減衰させる
    cursor.vx *= 0.9;
    cursor.vy *= 0.9;

    stats.fps = Math.round(1000 / Math.max(1, meter.avg));
    opts.onStats?.({ ...stats });

    if (!downgraded && meter.slow) {
      slowFrames++;
      if (slowFrames > 12) {
        downgraded = true;
        const next = degrade(q);
        if (next && q.tier !== "battery") opts.onDowngrade?.(next);
      }
    } else {
      slowFrames = 0;
    }
  }

  function shouldRun() {
    return running && visible && onScreen && !document.hidden;
  }

  function play() {
    if (opts.reducedMotion || staticOnly) return; // 静止画にrAFは使わない
    if (!shouldRun() || raf) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const onVisibility = () => {
    visible = !document.hidden;
    if (shouldRun()) play();
    else pause();
  };

  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    cursor.vx = nx - cursor.x;
    cursor.vy = ny - cursor.y;
    cursor.x = Math.min(1, Math.max(0, nx));
    cursor.y = Math.min(1, Math.max(0, ny));
    if (core && !opts.reducedMotion) core.spawn(cursor.x, 1 - cursor.y, 3);
  };

  const onDown = () => {
    cursor.down = 1;
  };
  const onUp = () => {
    cursor.down = 0;
  };

  const onResize = () => size();
  const dprQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      : null;
  const onDpr = () => size();
  const onContextLost = (e: Event) => {
    e.preventDefault();
    pause();
  };
  const onContextRestored = () => {
    size();
    play();
  };

  size();
  const resizeObserver = new ResizeObserver(size);
  resizeObserver.observe(canvas);

  canvas.addEventListener("pointermove", onPointer, { passive: true });
  canvas.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("resize", onResize);
  // 画面間の移動やブラウザ zoom で DPR が変わったときも作り直す
  try {
    dprQuery?.addEventListener("change", onDpr);
  } catch {
    /* 古い Safari */
  }
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost as EventListener);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  // IntersectionObserver が無い環境（テスト・古いブラウザ）では常に可視として扱う
  const io =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((en) => en.isIntersecting);
            if (shouldRun()) play();
            else pause();
          },
          { threshold: 0.01 },
        )
      : null;
  io?.observe(canvas);

  // 開いた直後は必ず 1 枚描く（真っ黒を避ける）
  renderer.frame(
    0,
    0,
    cursor,
    core?.links() ?? new Float32Array(0),
    core?.linkCount() ?? 0,
    core?.particles() ?? new Float32Array(0),
    core?.count() ?? 0,
  );

  return {
    resize: size,
    start() {
      running = true;
      play();
    },
    stop() {
      running = false;
      pause();
    },
    dispose() {
      disposed = true;
      resizeObserver.disconnect();
      pause();
      io?.disconnect();
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      try {
        dprQuery?.removeEventListener("change", onDpr);
      } catch {
        /* noop */
      }
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener(
        "webglcontextlost",
        onContextLost as EventListener,
      );
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer?.dispose();
      renderer = null;
    },
    stats: () => ({ ...stats }),
  };
}
