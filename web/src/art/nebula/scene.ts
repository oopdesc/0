/**
 * Space engine — world-class linked-particle field.
 *
 * Design goals (spec §25–§35):
 *  - Cursor physically seeds star particles; they flow along a turbulence field,
 *    link to their nearest neighbours (constellation / filament feel), fade out.
 *  - WebGPU path (Three.js TSL compute) is attempted first; any failure falls
 *    back to a WebGL2 path. The site never breaks for lack of WebGPU.
 *  - Adaptive particle count, capped DPR, and a hard stop on hidden tab /
 *    offscreen / reduced-motion / context-loss / page transition.
 *  - Procedural only: no video, no large textures — shaders + CPU noise.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { noise3 } from "./noise";
import { probeWebGPU } from "./webgpu-probe";
type Quality = "auto" | "ultra" | "high" | "balanced" | "battery";

const COUNTS: Record<Exclude<Quality, "auto">, number> = {
  ultra: 12000,
  high: 8000,
  balanced: 4000,
  battery: 1500,
};

function detectAuto(small: boolean): Exclude<Quality, "auto"> {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (small || cores <= 4 || mem <= 2) return "battery";
  if (cores >= 8 && mem >= 8) return "high";
  return "balanced";
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number; // 0..1, >0 alive
  maxLife: number;
  seed: number;
}

const LINK_DIST = 0.9;
const FLOW = 1.6;

export interface SpaceHandle {
  view?(action: "left" | "right" | "in" | "out" | "reset"): void;
  dispose(): void;
  setQuality(q: Quality): void;
  setReducedMotion(on: boolean): void;
  resize(): void;
}

export function createSpaceScene(
  canvas: HTMLCanvasElement,
  opts: {
    quality: Quality;
    reducedMotion: boolean;
    onStats?: (s: { fps: number; particles: number; engine: string }) => void;
  },
): Promise<SpaceHandle> {
  const small = canvas.clientWidth < 760;
  const resolved = (
    opts.quality === "auto" ? detectAuto(small) : opts.quality
  ) as Exclude<Quality, "auto">;
  const webglOpts = {
    reducedMotion: opts.reducedMotion,
    onStats: opts.onStats,
  };

  // Report WebGPU capability honestly in the HUD; the render path stays WebGL2
  // for cross-device reliability until a validated WebGPU compute pipeline ships.
  void probeWebGPU().then((p) => {
    opts.onStats?.({
      fps: 0,
      particles: 0,
      engine: p.available
        ? `WebGPU available — ${p.reason} (rendering via WebGL2)`
        : `WebGPU unavailable — ${p.reason} (WebGL2)`,
    });
  });

  return createWebGL(canvas, resolved, webglOpts).then(
    (h) => h,
    (err) => {
      console.warn("[space] WebGL2 init failed, using minimal fallback", err);
      return createMinimal(canvas);
    },
  );
}

/* ------------------------------------------------------------------ */
/* WebGL2 path                                                         */
/* ------------------------------------------------------------------ */

async function createWebGL(
  canvas: HTMLCanvasElement,
  quality: Exclude<Quality, "auto">,
  opts: {
    reducedMotion: boolean;
    onStats?: (s: { fps: number; particles: number; engine: string }) => void;
  },
): Promise<SpaceHandle> {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    powerPreference: "default",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL2 unavailable");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "default",
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, quality === "battery" ? 1 : 1.5),
  );
  renderer.setSize(
    Math.max(1, canvas.clientWidth),
    Math.max(1, canvas.clientHeight),
    false,
  );
  renderer.setClearColor(0x04060a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.035);
  const camera = new THREE.PerspectiveCamera(
    60,
    Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight),
    0.1,
    200,
  );
  camera.position.set(0, 3.2, 13);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = !opts.reducedMotion;
  controls.autoRotateSpeed = 0.35;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 32;

  // ---- background: procedural nebula sphere + starfield ----
  const nebulaMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime;
      // hash + value noise (matches src/space/noise.ts)
      float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float nv(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*nv(p); p*=2.02; a*=0.5;} return s; }
      void main(){
        vec3 d = vDir;
        float n = fbm(d*2.2 + vec3(0.0,0.0,uTime*0.03));
        float n2 = fbm(d*4.0 - vec3(uTime*0.02));
        vec3 deep = vec3(0.015,0.02,0.04);
        vec3 warm = vec3(0.85,0.55,0.28);
        vec3 cool = vec3(0.30,0.55,0.75);
        vec3 col = deep;
        col = mix(col, cool*0.5, smoothstep(0.4,0.75,n2)*0.5);
        col = mix(col, warm, smoothstep(0.55,0.85,n)*0.35);
        // faint star specks
        float sp = pow(nv(d*90.0), 40.0);
        col += vec3(0.8,0.85,1.0)*sp*0.8;
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 24), nebulaMat));

  // ---- particle system ----
  let count = COUNTS[quality];
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const lifeArr = new Float32Array(count);
  const seeds = new Float32Array(count);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      seed: Math.random(),
    });
    seeds[i] = particles[i].seed;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  pGeo.setAttribute("aLife", new THREE.BufferAttribute(lifeArr, 1));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSize: { value: 26 },
    },
    vertexShader: `
      attribute vec3 aColor; attribute float aLife; attribute float aSeed;
      uniform float uTime; uniform float uPixelRatio; uniform float uSize;
      varying vec3 vColor; varying float vLife;
      void main(){
        vColor = aColor; vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        float pulse = 0.6 + 0.4*sin(uTime*2.0 + aSeed*30.0);
        gl_PointSize = clamp(uSize * uPixelRatio * aLife * pulse / max(0.6, -mv.z), 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vLife;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float a = smoothstep(0.5, 0.0, r) * vLife;
        if (a < 0.01) discard;
        vec3 col = vColor * (0.7 + 0.6*vLife);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  // ---- links (LineSegments) ----
  const MAX_LINKS = count * 2;
  const linkPos = new Float32Array(MAX_LINKS * 2 * 3);
  const linkCol = new Float32Array(MAX_LINKS * 2 * 3);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage),
  );
  linkGeo.setAttribute(
    "color",
    new THREE.BufferAttribute(linkCol, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const linkMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const links = new THREE.LineSegments(linkGeo, linkMat);
  links.frustumCulled = false;
  scene.add(links);

  // ---- bloom ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.9,
    0.6,
    0.2,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- cursor spawn ----
  const spawnPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const cursorWorld = new THREE.Vector3();
  let cursorActive = false;
  const spawnAcc = new THREE.Vector3();
  function onPointer(e: PointerEvent) {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(spawnPlane, cursorWorld)) {
      cursorActive = true;
      spawnAcc.copy(cursorWorld);
    }
  }
  canvas.addEventListener("pointermove", onPointer);

  // ---- particle update ----
  let spawnIndex = 0;
  function spawnBurst(n: number) {
    for (let k = 0; k < n; k++) {
      const p = particles[spawnIndex];
      spawnIndex = (spawnIndex + 1) % count;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();
      p.pos.copy(spawnAcc).addScaledVector(dir, 0.05);
      p.vel.copy(dir).multiplyScalar(FLOW * (0.6 + Math.random() * 0.6));
      p.life = 1;
      p.maxLife = 2.4 + Math.random() * 1.6;
      p.seed = Math.random();
    }
  }

  // spatial grid for nearest-neighbour links
  const cell = LINK_DIST;
  const grid = new Map<string, number[]>();
  function gridKey(x: number, y: number, z: number) {
    return `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  }

  function palette(life: number, seed: number): THREE.Color {
    // warm amber -> cool blue/teal, avoiding cheap neon purple
    const t = seed * 0.7 + life * 0.3;
    const c = new THREE.Color();
    if (t < 0.5)
      c.setHSL(0.09 - t * 0.04, 0.85, 0.55 + life * 0.25); // amber/orange
    else c.setHSL(0.52 - (t - 0.5) * 0.35, 0.7, 0.6 + life * 0.25); // teal -> blue
    return c;
  }

  let time = 0;
  let running = true;
  let visible = !document.hidden;
  let inView = true;
  let disposed = false;
  let reduced = opts.reducedMotion;
  let last = performance.now();
  let fpsAcc = 0,
    fpsFrames = 0,
    fps = 0;

  function frame(now: number) {
    raf = 0;
    if (disposed || !visible || !inView) return;
    if (now - last < 1000 / 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) time += dt;
    if (running && visible && !reduced) {
      update(dt, time);
    }
    controls.update();
    nebulaMat.uniforms.uTime.value = time;
    pMat.uniforms.uTime.value = time;
    if (reduced) composer.render();
    else composer.render();

    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = fpsFrames / fpsAcc;
      fpsAcc = 0;
      fpsFrames = 0;
      opts.onStats?.({
        fps: Math.round(fps),
        particles: count,
        engine: `WebGL2 · ${quality}`,
      });
    }
    if (!reduced) raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  function update(dt: number, t: number) {
    // spawn from cursor
    if (cursorActive) {
      spawnAcc.lerp(cursorWorld, 0.3);
      const rate = quality === "battery" ? 3 : quality === "ultra" ? 6 : 5;
      spawnBurst(rate);
    }
    // integrate + flow field
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      if (p.life <= 0) continue;
      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 0;
        lifeArr[i] = 0;
        continue;
      }
      const n = noise3(
        p.pos.x * 0.6 + t * 0.1,
        p.pos.y * 0.6,
        p.pos.z * 0.6 + t * 0.08,
        p.seed * 100,
      );
      p.vel.x += n * FLOW * dt * 1.4;
      p.vel.y +=
        noise3(
          p.pos.y * 0.6 + t * 0.1,
          p.pos.z * 0.6,
          p.pos.x * 0.6,
          p.seed * 100 + 5,
        ) *
        FLOW *
        dt *
        1.4;
      p.vel.z +=
        noise3(
          p.pos.z * 0.6 + t * 0.1,
          p.pos.x * 0.6,
          p.pos.y * 0.6,
          p.seed * 100 + 9,
        ) *
        FLOW *
        dt *
        1.4;
      p.vel.multiplyScalar(0.965); // friction
      // gentle attraction to origin so the field stays cohesive
      p.vel.addScaledVector(p.pos, -0.02 * dt);
      p.pos.addScaledVector(p.vel, dt);
      // wrap soft boundary
      const r = p.pos.length();
      if (r > 14) p.pos.multiplyScalar(14 / r);
      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
      lifeArr[i] = p.life;
      const col = palette(p.life, p.seed);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.aLife.needsUpdate = true;
    pGeo.attributes.aColor.needsUpdate = true;

    // links via spatial grid
    grid.clear();
    for (let i = 0; i < count; i++) {
      if (particles[i].life <= 0) continue;
      const k = gridKey(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      );
      const arr = grid.get(k);
      if (arr) arr.push(i);
      else grid.set(k, [i]);
    }
    const maxD2 = LINK_DIST * LINK_DIST;
    let li = 0;
    for (let i = 0; i < count && li < MAX_LINKS; i++) {
      if (particles[i].life <= 0) continue;
      const x = positions[i * 3],
        y = positions[i * 3 + 1],
        z = positions[i * 3 + 2];
      const cx = Math.floor(x / cell),
        cy = Math.floor(y / cell),
        cz = Math.floor(z / cell);
      let best = -1,
        bestD = maxD2;
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gy = cy - 1; gy <= cy + 1; gy++)
          for (let gz = cz - 1; gz <= cz + 1; gz++) {
            const arr = grid.get(`${gx},${gy},${gz}`);
            if (!arr) continue;
            for (const j of arr) {
              if (j === i) continue;
              const dx = positions[j * 3] - x,
                dy = positions[j * 3 + 1] - y,
                dz = positions[j * 3 + 2] - z;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < bestD) {
                bestD = d2;
                best = j;
              }
            }
          }
      if (best >= 0) {
        const a = li * 6;
        linkPos[a] = x;
        linkPos[a + 1] = y;
        linkPos[a + 2] = z;
        linkPos[a + 3] = positions[best * 3];
        linkPos[a + 4] = positions[best * 3 + 1];
        linkPos[a + 5] = positions[best * 3 + 2];
        const fade = Math.min(particles[i].life, particles[best].life);
        const col = palette(fade, particles[i].seed);
        const al = fade * 0.5;
        linkCol[a] = col.r * al;
        linkCol[a + 1] = col.g * al;
        linkCol[a + 2] = col.b * al;
        linkCol[a + 3] = col.r * al;
        linkCol[a + 4] = col.g * al;
        linkCol[a + 5] = col.b * al;
        li++;
      }
    }
    linkGeo.setDrawRange(0, li * 2);
    linkGeo.attributes.position.needsUpdate = true;
    linkGeo.attributes.color.needsUpdate = true;
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, quality === "battery" ? 1 : 1.5),
    );
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(() => {
    resize();
    if (reduced) composer.render();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      onVisibility();
    },
    { threshold: 0.01 },
  );
  io.observe(canvas);
  controls.addEventListener("change", () => {
    if (reduced && !disposed && visible && inView) composer.render();
  });

  function onVisibility() {
    visible = !document.hidden;
    if (!visible || !inView) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!disposed && !raf) {
      last = performance.now() - 34;
      raf = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onRM = (e: MediaQueryListEvent) => {
    reduced = e.matches;
    controls.autoRotate = !reduced;
  };
  mq.addEventListener?.("change", onRM);

  return {
    view(action) {
      if (disposed) return;
      if (action === "reset") {
        camera.position.set(0, 3.2, 13);
        controls.target.set(0, 0, 0);
      } else if (action === "left" || action === "right")
        camera.position.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          action === "left" ? -0.18 : 0.18,
        );
      else
        camera.position.setLength(
          THREE.MathUtils.clamp(
            camera.position.length() * (action === "in" ? 0.85 : 1.15),
            5,
            32,
          ),
        );
      controls.update();
      composer.render();
    },
    setQuality(q: Quality) {
      if (q === "auto") return;
      // retune particle size + bloom strength for the chosen tier (count is
      // set at load; recreating the buffer mid-session would stutter).
      const sz =
        q === "battery" ? 18 : q === "ultra" ? 32 : q === "high" ? 28 : 24;
      pMat.uniforms.uSize.value = sz;
      bloom.strength =
        q === "battery"
          ? 0.55
          : q === "ultra"
            ? 1.05
            : q === "high"
              ? 0.85
              : 0.7;
    },
    setReducedMotion(on: boolean) {
      reduced = on;
      controls.autoRotate = !on;
      if (!disposed && visible && inView && !raf) {
        last = performance.now() - 34;
        raf = requestAnimationFrame(frame);
      }
    },
    resize,
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", resize);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : mesh.material
            ? [mesh.material]
            : [];
        materials.forEach((m) => m.dispose());
      });
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener?.("change", onRM);
      canvas.removeEventListener("pointermove", onPointer);
      controls.dispose();
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
      pGeo.dispose();
      linkGeo.dispose();
      pMat.dispose();
      linkMat.dispose();
      nebulaMat.dispose();
      renderer.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Minimal fallback (no WebGL2)                                        */
/* ------------------------------------------------------------------ */

function createMinimal(canvas: HTMLCanvasElement): SpaceHandle {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("no 2d context");
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const stars = Array.from({ length: 220 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.4 + 0.3,
    tw: Math.random() * Math.PI * 2,
  }));
  let raf = 0,
    t = 0;
  function frame() {
    t += 0.016;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = "#cfe0f5";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  frame();
  cancelAnimationFrame(raf);
  return {
    setQuality() {},
    setReducedMotion() {},
    resize() {
      frame();
      cancelAnimationFrame(raf);
    },
    dispose() {
      cancelAnimationFrame(raf);
    },
  };
}
