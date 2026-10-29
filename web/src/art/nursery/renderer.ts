import { cameraBasis, noiseVolume, renderSize } from "./field";
import {
  fullVertex,
  volumeFragment,
  compositeFragment,
  starVertex,
  starFragment,
} from "./shaders";

export type NurseryStats = {
  fpsCap: number;
  volumePixels: number;
  drawingPixels: number;
  reduced: boolean;
  drawnFrames: number;
  gpuMs: number | null;
  lowPower: boolean;
};
export type NurseryHandle = {
  pause(on: boolean): void;
  view(action: "left" | "right" | "up" | "down" | "in" | "out" | "reset"): void;
  image(): string;
  dispose(): void;
};

/** A small ray-marched volume, composited beneath a crisp star field. No network. */
export function createNursery(
  canvas: HTMLCanvasElement,
  options: {
    paused: boolean;
    onFailure: () => void;
    onStats?: (s: NurseryStats) => void;
  },
): NurseryHandle {
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!context) throw Error("WebGL2 unavailable");
  const gl: WebGL2RenderingContext = context;
  const programs: WebGLProgram[] = [],
    textures: WebGLTexture[] = [],
    buffers: WebGLBuffer[] = [],
    vaos: WebGLVertexArrayObject[] = [];
  const makeProgram = (vs: string, fs: string) => {
    const shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map((type, i) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, i ? fs : vs);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const m = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw Error(m ?? "Shader compilation failed");
      }
      return s;
    });
    const p = gl.createProgram()!;
    shaders.forEach((s) => gl.attachShader(p, s));
    gl.linkProgram(p);
    shaders.forEach((s) => gl.deleteShader(s));
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      throw Error("Nebula program link failed");
    }
    programs.push(p);
    return p;
  };
  const volume = makeProgram(fullVertex, volumeFragment),
    composite = makeProgram(fullVertex, compositeFragment),
    stars = makeProgram(starVertex, starFragment);
  const locations = (p: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const vu = locations(volume, [
      "uNoise",
      "uOrigin",
      "uCamera",
      "uAspect",
      "uTime",
      "uSteps",
    ]),
    cu = locations(composite, ["uCloud"]),
    su = locations(stars, [
      "uCloud",
      "uOrigin",
      "uCamera",
      "uAspect",
      "uPixelRatio",
      "uResolution",
    ]);
  const noise = gl.createTexture()!;
  textures.push(noise);
  gl.bindTexture(gl.TEXTURE_3D, noise);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.R8,
    48,
    48,
    48,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    noiseVolume(),
  );
  for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
    gl.texParameteri(gl.TEXTURE_3D, axis, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const cloud = gl.createTexture()!;
  textures.push(cloud);
  gl.bindTexture(gl.TEXTURE_2D, cloud);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const target = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    cloud,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const triangle = gl.createVertexArray()!;
  vaos.push(triangle);
  const starVao = gl.createVertexArray()!;
  vaos.push(starVao);
  gl.bindVertexArray(starVao);
  const count = 3000,
    data = new Float32Array(count * 7);
  let randomState = 9241;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const z = random() * 2 - 1,
      phi = random() * Math.PI * 2,
      r = 18 + random() * 9,
      ring = Math.sqrt(1 - z * z),
      warm = random(),
      mag = Math.pow(random(), 9) * 0.25;
    data.set(
      [
        ring * Math.cos(phi) * r,
        z * r,
        ring * Math.sin(phi) * r,
        0.74 + warm * 0.26,
        0.79 + warm * 0.13,
        1 - warm * 0.25,
        mag,
      ],
      i * 7,
    );
  }
  for (let i = 3; i < 100; i++) {
    const o = i * 7;
    data[o] = (random() - 0.5) * 5;
    data[o + 1] = (random() - 0.5) * 6;
    data[o + 2] = random() * 2.5 - 1;
    data[o + 6] = 0.04 + Math.pow(random(), 3) * 0.27;
  }
  data.set([0.4, 0.4, 0.6, 1, 0.89, 0.72, 0.85], 0);
  data.set([-1.2, -0.85, 0.2, 0.78, 0.9, 1, 0.55], 7);
  data.set([1.4, 1.6, -0.3, 1, 0.8, 0.64, 0.3], 14);
  const starBuffer = gl.createBuffer()!;
  buffers.push(starBuffer);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  for (const [index, size, offset] of [
    [0, 3, 0],
    [1, 3, 12],
    [2, 1, 24],
  ]) {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, 28, offset);
  }
  gl.bindVertexArray(null);
  let disposed = false,
    lost = false,
    paused = options.paused,
    visible = !document.hidden,
    inView = true,
    raf = 0,
    timer = 0,
    last = 0,
    time = 0,
    yaw = 0.08,
    pitch = -0.04,
    distance = 4.8,
    drag: null | { id: number; x: number; y: number } = null;
  let volumeBudget = canvas.clientWidth < 600 ? 130000 : 420000,
    volumeWidth = 1,
    volumeHeight = 1,
    frameCount = 0;
  const small = canvas.clientWidth < 600;
  let cap = small ? 10 : 14,
    gpuMs: number | null = null,
    lowPower = false;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  // Only the slower direction is adaptive; the page never probes maximum throughput.
  const timerExtension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let query: WebGLQuery | null = null;
  const report = () =>
    options.onStats?.({
      fpsCap: cap,
      volumePixels: volumeWidth * volumeHeight,
      drawingPixels: canvas.width * canvas.height,
      reduced,
      drawnFrames: frameCount,
      gpuMs,
      lowPower,
    });
  function resize() {
    if (disposed || lost) return;
    const rect = canvas.getBoundingClientRect(),
      size = renderSize(rect.width, rect.height, devicePixelRatio, 720000),
      low = renderSize(rect.width, rect.height, 1.2, volumeBudget);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    if (low.width !== volumeWidth || low.height !== volumeHeight) {
      volumeWidth = low.width;
      volumeHeight = low.height;
      gl.bindTexture(gl.TEXTURE_2D, cloud);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        volumeWidth,
        volumeHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }
    report();
    schedule();
  }
  function draw(now: number) {
    if (disposed || lost) return;
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timerExtension!.GPU_DISJOINT_EXT)) {
        gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1_000_000;
        if (gpuMs! > 24 && volumeBudget > 70000) {
          volumeBudget = Math.max(70000, Math.floor(volumeBudget * 0.75));
          resize();
        }
        if (gpuMs! > 35) cap = 8;
        if (gpuMs! > 60 && volumeBudget <= 70000) lowPower = true;
        report();
      }
      gl.deleteQuery(query);
      query = null;
    }
    const measure = timerExtension && !query && frameCount % 30 === 1;
    if (measure) {
      query = gl.createQuery();
      gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, query);
    }
    if (!paused && !reduced && !lowPower && last)
      time += Math.min(0.2, (now - last) / 1000);
    last = now;
    frameCount++;
    canvas.dataset.drawnFrames = String(frameCount);
    canvas.dataset.animationStopped = String(paused || reduced || lowPower);
    const camera = cameraBasis(
        yaw +
          (!paused && !reduced && !lowPower
            ? Math.sin(time * 0.055) * 0.028
            : 0),
        pitch,
        distance,
      ),
      aspect = canvas.width / canvas.height;
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(triangle);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, volumeWidth, volumeHeight);
    gl.useProgram(volume);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, noise);
    gl.uniform1i(vu.uNoise, 0);
    gl.uniform3fv(vu.uOrigin, camera.origin);
    gl.uniformMatrix3fv(vu.uCamera, false, camera.matrix);
    gl.uniform1f(vu.uAspect, aspect);
    gl.uniform1f(vu.uTime, time);
    gl.uniform1i(vu.uSteps, small ? 28 : 48);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(composite);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cloud);
    gl.uniform1i(cu.uCloud, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(stars);
    gl.bindVertexArray(starVao);
    gl.uniform1i(su.uCloud, 1);
    gl.uniform3fv(su.uOrigin, camera.origin);
    gl.uniformMatrix3fv(su.uCamera, false, camera.matrix);
    gl.uniform1f(su.uAspect, aspect);
    gl.uniform1f(su.uPixelRatio, Math.min(1.35, devicePixelRatio || 1));
    gl.uniform2f(su.uResolution, canvas.width, canvas.height);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    if (measure) gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    if (frameCount === 1 || frameCount % 15 === 0) report();
  }
  function cancel() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    timer = raf = 0;
  }
  function schedule() {
    if (disposed || lost || timer || raf || !visible || !inView) return;
    timer = window.setTimeout(
      () => {
        timer = 0;
        raf = requestAnimationFrame(tick);
      },
      Math.max(0, 1000 / cap - (performance.now() - last)),
    );
  }
  function tick(now: number) {
    raf = 0;
    if (disposed || lost || !visible || !inView) return;
    draw(now);
    if (!paused && !reduced && !lowPower) schedule();
  }
  const visibility = () => {
    visible = !document.hidden;
    cancel();
    if (visible) schedule();
  };
  const motion = () => {
    reduced = media.matches;
    cancel();
    report();
    schedule();
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (e.buttons === 0) {
      drag = null;
      return;
    }
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    yaw = Math.max(-1.1, Math.min(1.1, yaw - dx * 0.0025));
    pitch = Math.max(-0.65, Math.min(0.65, pitch + dy * 0.002));
    drag.x = e.clientX;
    drag.y = e.clientY;
    schedule();
  };
  const up = () => {
    drag = null;
  };
  const contextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    cancel();
    options.onFailure();
  };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerup", up);
  window.addEventListener("blur", up);
  window.addEventListener("pointercancel", up);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", motion);
  const observer = new IntersectionObserver(
    ([e]) => {
      inView = e.isIntersecting;
      cancel();
      if (inView) schedule();
    },
    { threshold: 0.01 },
  );
  observer.observe(canvas);
  const sizing = new ResizeObserver(resize);
  sizing.observe(canvas);
  resize();
  return {
    pause(on) {
      paused = on;
      cancel();
      schedule();
    },
    view(action) {
      if (action === "reset") {
        yaw = 0.08;
        pitch = -0.04;
        distance = 4.8;
      }
      if (action === "left") yaw -= 0.12;
      if (action === "right") yaw += 0.12;
      if (action === "up") pitch += 0.1;
      if (action === "down") pitch -= 0.1;
      if (action === "in") distance -= 0.3;
      if (action === "out") distance += 0.3;
      yaw = Math.max(-1.1, Math.min(1.1, yaw));
      pitch = Math.max(-0.65, Math.min(0.65, pitch));
      distance = Math.max(3.5, Math.min(6.8, distance));
      schedule();
    },
    image() {
      if (disposed || lost) throw Error("描画を保存できません。");
      draw(performance.now());
      return canvas.toDataURL("image/png");
    },
    dispose() {
      disposed = true;
      cancel();
      observer.disconnect();
      sizing.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("blur", up);
      window.removeEventListener("pointercancel", up);
      canvas.removeEventListener("webglcontextlost", contextLost);
      if (query) gl.deleteQuery(query);
      programs.forEach((p) => gl.deleteProgram(p));
      textures.forEach((t) => gl.deleteTexture(t));
      buffers.forEach((b) => gl.deleteBuffer(b));
      vaos.forEach((v) => gl.deleteVertexArray(v));
      gl.deleteFramebuffer(target);
    },
  };
}
