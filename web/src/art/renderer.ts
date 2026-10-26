import {
  screenVertex,
  spaceFragment,
  pointsVertex,
  pointsFragment,
} from "./shaders";
import wasmMeta from "../wasm-manifest.json";
import type { ArtSettings } from "../java-model";
type Core = {
  memory: WebAssembly.Memory;
  galaxy_generate(count: number, seed: number): number;
  galaxy_ptr(): number;
  galaxy_len(): number;
};
let corePromise: Promise<Core> | undefined;
async function core() {
  corePromise ??= fetch(wasmMeta.url)
    .then(async (r) => {
      if (!r.ok) throw Error("Rust module unavailable");
      return (await WebAssembly.instantiate(await r.arrayBuffer(), {})).instance
        .exports as unknown as Core;
    })
    .catch((e) => {
      corePromise = undefined;
      throw e;
    });
  return corePromise;
}
export type RenderHandle = {
  update(value: ArtSettings): void;
  pause(value: boolean): void;
  image(): string;
  dispose(): void;
};
/** 独立した描画境界。React/Javaの画面状態を持たず、停止時のRAF/GL資源を確実に解放する。 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  settings: ArtSettings,
  paused: boolean,
  onReady: (engine: string) => void,
  onError: (message: string) => void,
): RenderHandle {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) throw Error("このブラウザではWebGL 2を利用できません。");
  function program(vertex: string, fragment: string) {
    const shaders = [vertex, fragment].map((source, i) => {
      const s = gl!.createShader(
        i === 0 ? gl!.VERTEX_SHADER : gl!.FRAGMENT_SHADER,
      )!;
      gl!.shaderSource(s, source);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        const reason = gl!.getShaderInfoLog(s);
        gl!.deleteShader(s);
        throw Error("Shader compile: " + reason);
      }
      return s;
    });
    const p = gl!.createProgram()!;
    shaders.forEach((s) => gl!.attachShader(p, s));
    gl!.linkProgram(p);
    shaders.forEach((s) => gl!.deleteShader(s));
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS))
      throw Error("Shader link failed");
    return p;
  }
  const space = program(screenVertex, spaceFragment),
    stars = program(pointsVertex, pointsFragment);
  const quad = gl.createBuffer()!,
    points = gl.createBuffer()!;
  const quadVAO = gl.createVertexArray()!,
    starsVAO = gl.createVertexArray()!;
  gl.bindVertexArray(quadVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pos = gl.getAttribLocation(space, "position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(starsVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, points);
  const attr = gl.getAttribLocation(stars, "star");
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const locations = (p: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const u = locations(space, [
    "resolution",
    "time",
    "seed",
    "tilt",
    "exposure",
    "scene",
    "pointer",
  ]);
  const v = locations(stars, ["resolution", "angle", "tilt", "zoom", "dpr"]);
  let value = settings,
    stopped = paused,
    disposed = false,
    visible = true,
    raf = 0,
    last = 0,
    clock = 0,
    dpr = 1,
    starCount = 0,
    sequence = 0,
    mouse = [0, 0],
    contextLost = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const draw = () => {
    if (disposed || contextLost) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(space);
    gl.bindVertexArray(quadVAO);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1f(u.time, clock);
    gl.uniform1f(u.seed, value.seed);
    gl.uniform1f(u.tilt, value.tilt);
    gl.uniform1f(u.exposure, value.exposure);
    gl.uniform1i(u.scene, value.mode);
    gl.uniform2f(u.pointer, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (starCount && value.mode === 0) {
      gl.useProgram(stars);
      gl.bindVertexArray(starsVAO);
      gl.uniform2f(v.resolution, canvas.width, canvas.height);
      gl.uniform1f(v.angle, clock * 0.018 + 0.24);
      gl.uniform1f(v.tilt, value.tilt + 0.45);
      gl.uniform1f(v.zoom, 1.12);
      gl.uniform1f(v.dpr, dpr);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, starCount);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  };
  const tick = (now: number) => {
    raf = 0;
    if (
      disposed ||
      !visible ||
      document.hidden ||
      stopped ||
      reduced.matches ||
      contextLost
    )
      return;
    if (now - last >= 1000 / 24) {
      clock += Math.min((now - last) / 1000, 0.075);
      last = now;
      draw();
    }
    raf = requestAnimationFrame(tick);
  };
  const restart = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = performance.now();
    draw();
    if (
      !disposed &&
      visible &&
      !document.hidden &&
      !stopped &&
      !reduced.matches &&
      !contextLost
    )
      raf = requestAnimationFrame(tick);
  };
  const resize = () => {
    const b = canvas.getBoundingClientRect();
    dpr = Math.min(
      devicePixelRatio || 1,
      1.7,
      Math.sqrt(2_400_000 / Math.max(1, b.width * b.height)),
    );
    canvas.width = Math.max(1, Math.round(b.width * dpr));
    canvas.height = Math.max(1, Math.round(b.height * dpr));
    restart();
  };
  const generate = async () => {
    const generation = ++sequence;
    try {
      const wasm = await core();
      if (disposed || generation !== sequence) return;
      wasm.galaxy_generate(32000, value.seed);
      const data = new Float32Array(
        wasm.memory.buffer,
        wasm.galaxy_ptr(),
        wasm.galaxy_len(),
      ).slice();
      gl.bindBuffer(gl.ARRAY_BUFFER, points);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      starCount = data.length / 4;
      onReady("Java · Rust/Wasm · WebGL 2");
      restart();
    } catch {
      if (!disposed) {
        onReady("Java · WebGL 2");
        onError("星の座標を読み込めませんでした。星雲の描画は続けられます。");
      }
    }
  };
  const move = (e: PointerEvent) => {
    if (stopped || reduced.matches) return;
    const b = canvas.getBoundingClientRect();
    mouse = [
      (e.clientX - b.left) / b.width - 0.5,
      (e.clientY - b.top) / b.height - 0.5,
    ];
  };
  const lost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf);
    onError("描画が一時停止しました。再読み込みで復帰できます。");
  };
  const restored = () =>
    onError("描画資源が復帰しました。ページを再読み込みしてください。");
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    restart();
  });
  intersection.observe(canvas);
  document.addEventListener("visibilitychange", restart);
  reduced.addEventListener("change", restart);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  resize();
  void generate();
  return {
    update(next) {
      const changed = next.seed !== value.seed;
      value = next;
      if (changed) void generate();
      restart();
    },
    pause(next) {
      stopped = next;
      restart();
    },
    image() {
      draw();
      return canvas.toDataURL("image/png");
    },
    dispose() {
      disposed = true;
      sequence++;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      gl.deleteBuffer(quad);
      gl.deleteBuffer(points);
      gl.deleteVertexArray(quadVAO);
      gl.deleteVertexArray(starsVAO);
      gl.deleteProgram(space);
      gl.deleteProgram(stars);
    },
  };
}
