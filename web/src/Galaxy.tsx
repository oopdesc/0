import { useEffect, useRef, useState } from "react";
import wasmMeta from "./wasm-manifest.json";

type Core = {
  memory: WebAssembly.Memory;
  galaxy_generate(count: number, seed: number): number;
  galaxy_ptr(): number;
  galaxy_len(): number;
};
let loaded: Promise<Core> | undefined;
function core() {
  loaded ??= fetch(wasmMeta.url)
    .then(async (response) => {
      if (!response.ok) throw new Error("Wasm unavailable");
      const { instance } = await WebAssembly.instantiate(
        await response.arrayBuffer(),
        {},
      );
      return instance.exports as unknown as Core;
    })
    .catch((error) => {
      loaded = undefined;
      throw error;
    });
  return loaded;
}

/** Rustが所有する座標を読み、Canvasへ投影する。画面外・非表示タブでは更新しない。 */
export default function Galaxy({
  paused,
  count = 1200,
  seed = 42,
  large = false,
}: {
  paused: boolean;
  count?: number;
  seed?: number;
  large?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState("読み込み中");
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d", { alpha: true });
    if (!ctx) {
      setEngine("静止背景");
      return;
    }
    let cancelled = false,
      frame = 0,
      visible = true,
      last = 0,
      angle = 0.42;
    let width = 1,
      height = 1,
      points = new Float32Array(0);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const box = node.getBoundingClientRect();
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      const dpr = Math.min(
        devicePixelRatio || 1,
        1.35,
        Math.sqrt(1_800_000 / (width * height)),
      );
      node.width = Math.round(width * dpr);
      node.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      if (!points.length) return;
      const radius = Math.min(width * 0.42, height * 0.8);
      const ca = Math.cos(angle),
        sa = Math.sin(angle);
      const colors = ["#b5a1f7", "#a9d9ec", "#f0e6f9"];
      for (let group = 0; group < 3; group++) {
        ctx.beginPath();
        ctx.fillStyle = colors[group];
        for (let i = group * 4; i < points.length; i += 12) {
          const x = points[i] * ca - points[i + 1] * sa;
          const y = points[i] * sa + points[i + 1] * ca;
          const depth = 1 + y * 0.13;
          const px = width * 0.52 + x * radius * depth;
          const py = height * 0.51 + (y * 0.38 + points[i + 2]) * radius;
          const size = (0.6 + points[i + 3] * 1.25) * depth;
          ctx.rect(px, py, size, size);
        }
        ctx.fill();
      }
    };
    const tick = (time: number) => {
      frame = 0;
      if (cancelled || !visible || document.hidden || paused || reduce.matches)
        return;
      if (time - last >= 1000 / 24) {
        angle += Math.min((time - last) / 1000, 0.05) * 0.032;
        last = time;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = performance.now();
      draw();
      if (!paused && !reduce.matches && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(node);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      restart();
    });
    intersection.observe(node);
    document.addEventListener("visibilitychange", restart);
    reduce.addEventListener("change", restart);
    core()
      .then((wasm) => {
        if (cancelled) return;
        wasm.galaxy_generate(Math.min(1800, Math.max(100, count)), seed);
        // generate後に再取得し、ページ内の別インスタンスが再生成しても安全なように複製する。
        points = new Float32Array(
          wasm.memory.buffer,
          wasm.galaxy_ptr(),
          wasm.galaxy_len(),
        ).slice();
        setEngine("Rust / Wasm");
        resize();
        restart();
      })
      .catch(() => {
        if (!cancelled) setEngine("静止背景");
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", restart);
      reduce.removeEventListener("change", restart);
    };
  }, [paused, count, seed]);
  return (
    <div className={`galaxy ${large ? "galaxy-large" : ""}`}>
      <div className="galaxy-halo" />
      <canvas
        ref={canvas}
        aria-label="Rustで生成した装飾的な渦巻銀河"
        role="img"
      />
      <div className="galaxy-orbit orbit-one" />
      <div className="galaxy-orbit orbit-two" />
      <div className="galaxy-meta">
        <span className="signal" />
        {engine}
        <span className="meta-separator">/</span>
        {engine === "Rust / Wasm"
          ? `${count.toLocaleString()} particles`
          : "Cosmic background"}
      </div>
      <span className="galaxy-coordinate">α 00h 42m · δ +41°</span>
    </div>
  );
}
