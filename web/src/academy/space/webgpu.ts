/**
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   https://github.com/ULuIQ12/webgpu-tsl-linkedparticles
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している（コピーではない）。
 *   クレジットの全文は THIRD_PARTY_NOTICES.md。
 */
/**
 * WebGPU バックエンド。
 *
 * - 計算シェーダ（compute）で「塵」を 4,096〜16,384 個動かす
 * - 星座のアンカー（Rust/wasm が計算した粒子）とリンクは頂点バッファで描く
 * - 背景は fullscreen の手続き生成（テクスチャ無し）
 * - 最後に bloom とトーンマップ（ACES 近似）でまとめる
 *
 * すべての初期化は失敗しても null を返し、呼び出し側が WebGL2 へ落とす。
 */
import type { Quality } from './quality';

export interface CursorState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  down: number;
}

export interface SpaceRenderer {
  readonly backend: 'webgpu' | 'webgl2' | 'static';
  resize(w: number, h: number, dpr: number): void;
  frame(t: number, dt: number, cursor: CursorState, links: Float32Array, linkCount: number, anchors: Float32Array, anchorCount: number): void;
  dispose(): void;
}

const UNI_FLOATS = 12; // 48 bytes

const WGSL_UNI = /* wgsl */ `
struct Uni {
  res: vec2f,
  time: f32,
  dt: f32,
  cursor: vec2f,
  attract: f32,
  count: f32,
  dpr: f32,
  bloom: f32,
  pad: vec2f,
};
`;

const BG = /* wgsl */ `
${WGSL_UNI}
@group(0) @binding(0) var<uniform> u: Uni;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var v = 0.0;
  var amp = 0.5;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + amp * vnoise(p);
    p = p * 2.03 + vec2f(17.3, 9.1);
    amp = amp * 0.5;
  }
  return v;
}

// 星を 1 層ぶん足す。層ごとにスケールと明るさを変えて奥行きを出す。
fn starLayer(p: vec2f, scale: f32, size: f32, bright: f32, drift: vec2f) -> vec3f {
  let q = p * scale + drift;
  let cell = floor(q);
  let f = fract(q) - 0.5;
  let rnd = hash21(cell);
  if (rnd < 0.86) { return vec3f(0.0); }
  let off = vec2f(hash21(cell + 3.7), hash21(cell + 9.1)) - 0.5;
  let d = length(f - off * 0.7);
  let core = smoothstep(size, 0.0, d);
  let temp = hash21(cell + 21.0);
  // 色温度: 青白 → 白 → 橙
  var tint = mix(vec3f(0.72, 0.82, 1.0), vec3f(1.0, 0.94, 0.84), temp);
  tint = mix(tint, vec3f(1.0, 0.78, 0.58), smoothstep(0.93, 1.0, temp));
  let twinkle = 0.82 + 0.18 * sin(u.time * (0.6 + temp * 1.7) + rnd * 40.0);
  return tint * core * bright * twinkle;
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let res = u.res;
  let uv = fc.xy / res;
  let p = (fc.xy - res * 0.5) / res.y;
  // 視点のわずかな移動（parallax）
  let par = (u.cursor - vec2f(0.5)) * 0.05;

  let base = mix(vec3f(0.010, 0.013, 0.022), vec3f(0.028, 0.032, 0.046), uv.y);

  // 星雲: ドメインワープした fbm。紫に寄らないよう、青緑と琥珀で組む。
  let q = (p + par) * 1.45 + vec2f(u.time * 0.0045, -u.time * 0.0032);
  let warp = vec2f(fbm(q * 1.7), fbm(q * 1.7 + vec2f(4.7, 2.3)));
  let n = fbm(q + warp * 1.35);
  let lanes = fbm(q * 3.1 + warp * 2.0);
  let dust = smoothstep(0.38, 0.86, n);
  let fine = smoothstep(0.55, 0.95, lanes);

  var col = base;
  col = col + vec3f(0.055, 0.105, 0.118) * dust * 0.75;         // 青緑の塵
  col = col + vec3f(0.150, 0.112, 0.062) * pow(dust, 2.2) * 0.55; // 暖かい塵
  col = col + vec3f(0.020, 0.030, 0.055) * fine * 0.6;           // 淡い青
  // 中心のわずかな明るみ（重力の気配）
  let r = length(p - par * 2.0);
  col = col + vec3f(0.030, 0.036, 0.042) * exp(-r * 2.6);

  // 星は 3 層。奥ほど小さく暗く、視差も小さい。
  var stars = vec3f(0.0);
  stars = stars + starLayer(p, 22.0, 0.10, 0.55, par * 0.4);
  stars = stars + starLayer(p, 13.0, 0.13, 0.85, par * 0.9 + vec2f(3.1, 7.7));
  stars = stars + starLayer(p, 8.0, 0.16, 1.15, par * 1.6 + vec2f(11.3, 2.9));
  col = col + stars;

  return vec4f(col, 1.0);
}
`;

const DUST = /* wgsl */ `
${WGSL_UNI}
struct P {
  pos: vec4f,   // x, y, vx, vy
  info: vec4f,  // life, seed, size, hue
};
@group(0) @binding(0) var<storage, read_write> ps: array<P>;
@group(0) @binding(1) var<uniform> u: Uni;

fn hash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn flow(p: vec2f, t: f32) -> vec2f {
  let a = sin(p.y * 5.3 + t * 0.16) + 0.55 * sin(p.x * 9.1 - t * 0.11);
  let b = cos(p.x * 6.7 - t * 0.13) + 0.55 * cos(p.y * 11.3 + t * 0.07);
  return vec2f(a, b);
}

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(u.count)) { return; }
  var p = ps[i];
  let seed = p.info.y;
  let dt = clamp(u.dt, 0.0, 0.05);

  // 流れ + カーソルの重力 + 接線
  let f = flow(p.pos.xy * 3.2, u.time + seed * 6.28);
  var acc = f * 0.055;
  let to_c = u.cursor - p.pos.xy;
  let d = max(length(to_c), 0.02);
  let g = u.attract * 0.0022 / (d + 0.10);
  acc = acc + (to_c / d) * g + vec2f(-to_c.y, to_c.x) / d * g * 0.6;

  var v = p.pos.zw + acc * dt;
  v = v * 0.985;
  let sp = length(v);
  if (sp > 0.6) { v = v / sp * 0.6; }
  var xy = p.pos.xy + v * dt;
  var life = p.info.x - dt * (0.03 + sp * 0.20);
  var info = p.info;

  if (life <= 0.0 || xy.x < -0.1 || xy.x > 1.1 || xy.y < -0.1 || xy.y > 1.1) {
    // 決定的に再配置（乱数は使わない）
    let h1 = hash(vec2f(f32(i) * 0.7318, u.time * 0.013));
    let h2 = hash(vec2f(f32(i) * 1.3177, u.time * 0.011 + 3.7));
    xy = vec2f(h1, h2);
    v = vec2f(0.0);
    life = 0.55 + 0.45 * hash(vec2f(f32(i) * 2.11, 9.3));
    info = vec4f(life, hash(vec2f(f32(i), 1.7)), 0.6 + 1.6 * hash(vec2f(f32(i), 5.1)), hash(vec2f(f32(i), 8.3)));
  } else {
    info = vec4f(life, seed, info.z, info.w);
  }

  ps[i] = P(vec4f(xy, v), info);
}
`;

const DUST_DRAW = /* wgsl */ `
${WGSL_UNI}
struct P {
  pos: vec4f,
  info: vec4f,
};
@group(0) @binding(0) var<storage, read> ps: array<P>;
@group(0) @binding(1) var<uniform> u: Uni;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) bright: f32,
  @location(2) hue: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  let p = ps[ii];
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let c = corners[vi];
  let alive = step(0.001, p.info.x);
  let size = (1.1 + p.info.z * 1.3) * u.dpr * alive;
  let clip = (p.pos.xy * u.res - u.res * 0.5) * 2.0 / u.res.y;
  let px = c * size * 2.0 / u.res.y;
  var out: VOut;
  out.pos = vec4f(clip + px, 0.0, 1.0);
  out.uv = c;
  out.bright = alive * pow(p.info.x, 0.7);
  out.hue = p.info.w;
  return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  let core = smoothstep(1.0, 0.0, r);
  let glow = pow(core, 3.0);
  let tint = mix(vec3f(0.62, 0.80, 1.0), vec3f(1.0, 0.88, 0.70), in.hue);
  let c = tint * (glow * 0.9 + core * 0.25) * in.bright;
  return vec4f(c, 1.0);
}
`;

const ANCHOR_DRAW = /* wgsl */ `
${WGSL_UNI}
@group(0) @binding(0) var<uniform> u: Uni;

struct AIn {
  @location(0) xy: vec2f,
  @location(1) misc: vec4f, // life, seed, size, glow
};

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) bright: f32,
  @location(2) seed: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, a: AIn) -> VOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let c = corners[vi];
  let size = a.misc.z * u.dpr * 2.2;
  let clip = (a.xy * u.res - u.res * 0.5) * 2.0 / u.res.y;
  var out: VOut;
  out.pos = vec4f(clip + c * size * 2.0 / u.res.y, 0.0, 1.0);
  out.uv = c;
  out.bright = a.misc.x * a.misc.w;
  out.seed = a.misc.y;
  return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  let core = smoothstep(1.0, 0.0, r);
  let halo = pow(core, 5.0);
  let tint = mix(vec3f(0.70, 0.88, 1.0), vec3f(1.0, 0.92, 0.78), fract(in.seed * 7.3));
  let c = tint * (halo * 1.5 + core * 0.32) * max(in.bright, 0.0);
  return vec4f(c, 1.0);
}
`;

const LINK_DRAW = /* wgsl */ `
${WGSL_UNI}
@group(0) @binding(0) var<uniform> u: Uni;

struct LIn {
  @location(0) xy: vec2f,
  @location(1) strength: f32,
};

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) strength: f32,
};

@vertex
fn vs(l: LIn) -> VOut {
  let clip = (l.xy * u.res - u.res * 0.5) * 2.0 / u.res.y;
  var out: VOut;
  out.pos = vec4f(clip, 0.0, 1.0);
  out.strength = l.strength;
  return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  // 線は青緑寄りの淡い光。紫のネオンにはしない。
  let c = vec3f(0.42, 0.72, 0.78) * in.strength * 0.55;
  return vec4f(c, 1.0);
}
`;

const FULLSCREEN_VS = /* wgsl */ `
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[i], 0.0, 1.0);
}
`;

const BRIGHT = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
${FULLSCREEN_VS}
@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(tex, 0));
  let uv = fc.xy / dims;
  var c = textureSample(tex, samp, uv).rgb;
  let l = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  c = c * smoothstep(0.22, 1.1, l);
  return vec4f(c, 1.0);
}
`;

const BLUR = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
struct B { dir: vec2f, pad: vec2f };
@group(0) @binding(2) var<uniform> b: B;
${FULLSCREEN_VS}
@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(tex, 0));
  let uv = fc.xy / dims;
  let px = b.dir / dims;
  var sum = textureSample(tex, samp, uv).rgb * 0.227;
  sum = sum + textureSample(tex, samp, uv + px * 1.3846).rgb * 0.316;
  sum = sum + textureSample(tex, samp, uv - px * 1.3846).rgb * 0.316;
  sum = sum + textureSample(tex, samp, uv + px * 3.2308).rgb * 0.070;
  sum = sum + textureSample(tex, samp, uv - px * 3.2308).rgb * 0.070;
  return vec4f(sum, 1.0);
}
`;

const COMPOSITE = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloom: texture_2d<f32>;
struct C { res: vec2f, time: f32, amount: f32 };
@group(0) @binding(3) var<uniform> c: C;
${FULLSCREEN_VS}
@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let res = c.res;
  let uv = fc.xy / res;
  let base = textureSample(scene, samp, uv).rgb;
  let glow = textureSample(bloom, samp, uv).rgb;
  var col = base + glow * c.amount;

  // ACES 近似
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  // ビネット（中心は残す）
  let p = (fc.xy - res * 0.5) / res.y;
  let vig = smoothstep(1.25, 0.25, length(p));
  col = col * mix(0.82, 1.0, vig);
  // フィルムグレイン（静止画に粒子感を足す。動きは最小）
  let g = fract(sin(dot(fc.xy + c.time, vec2f(12.9898, 78.233))) * 43758.5453);
  col = col + (g - 0.5) * 0.012;
  // ガンマ
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  return vec4f(col, 1.0);
}
`;

export async function createWebGPU(canvas: HTMLCanvasElement, q: Quality): Promise<SpaceRenderer | null> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return null;

  let device: GPUDevice;
  let context: GPUCanvasContext;
  let format: GPUTextureFormat;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    device = await adapter.requestDevice();
    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;
    context = ctx;
    format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
  } catch {
    return null;
  }

  const mkRender = (code: string, opts: { topology?: GPUPrimitiveTopology; blend?: boolean; buffers?: GPUVertexBufferLayout[] }): GPURenderPipeline => {
    const module = device.createShaderModule({ code });
    return device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs', buffers: opts.buffers ?? [] },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format: 'rgba16float',
            blend: opts.blend
              ? { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } }
              : undefined,
          },
        ],
      },
      primitive: { topology: opts.topology ?? 'triangle-list' },
    });
  };

  const mkCompute = (code: string): GPUComputePipeline => {
    const module = device.createShaderModule({ code });
    return device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'step' } });
  };

  try {
    const uni = device.createBuffer({ size: UNI_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const dustCount = q.dust;
    const dustBuf = device.createBuffer({
      size: Math.max(32, dustCount * 32),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    // 初期状態（決定的）
    const init = new Float32Array(dustCount * 8);
    for (let i = 0; i < dustCount; i++) {
      const a = hash01(i * 0.7318);
      const b = hash01(i * 1.3177 + 5.2);
      init[i * 8] = a;
      init[i * 8 + 1] = b;
      init[i * 8 + 4] = 0.4 + hash01(i * 2.11) * 0.6;
      init[i * 8 + 5] = hash01(i * 3.77);
      init[i * 8 + 6] = 0.5 + hash01(i * 5.13) * 1.5;
      init[i * 8 + 7] = hash01(i * 9.31);
    }
    device.queue.writeBuffer(dustBuf, 0, init);

    const bgPipe = mkRender(BG, {});
    const dustPipe = mkCompute(DUST);
    const dustDraw = mkRender(DUST_DRAW, { blend: true });
    const anchorPipe = mkRender(ANCHOR_DRAW, {
      blend: true,
      buffers: [
        { arrayStride: 24, stepMode: 'instance', attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 1, offset: 8, format: 'float32x4' },
        ] },
      ],
    });
    const linkPipe = mkRender(LINK_DRAW, {
      blend: true,
      topology: 'line-list',
      buffers: [{ arrayStride: 12, stepMode: 'vertex', attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' },
        { shaderLocation: 1, offset: 8, format: 'float32' },
      ] }],
    });
    const brightPipe = mkRender(BRIGHT, {});
    const blurPipe = mkRender(BLUR, {});
    const compPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: device.createShaderModule({ code: COMPOSITE }), entryPoint: 'vs' },
      fragment: { module: device.createShaderModule({ code: COMPOSITE }), entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const blurUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const compUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // アンカー / リンクの動的バッファ（最大サイズで確保して書き込み量だけ変える）
    const MAX_ANCHORS = 2048;
    const MAX_LINKS = 4096;
    const anchorBuf = device.createBuffer({ size: MAX_ANCHORS * 24, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const linkBuf = device.createBuffer({ size: MAX_LINKS * 2 * 12, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    let w = 1;
    let h = 1;
    let dpr = 1;
    let sceneTex: GPUTexture | null = null;
    let bloomA: GPUTexture | null = null;
    let bloomB: GPUTexture | null = null;

    const makeTex = (width: number, height: number) =>
      device.createTexture({
        size: [Math.max(1, width), Math.max(1, height)],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });

    function rebuild() {
      sceneTex?.destroy();
      bloomA?.destroy();
      bloomB?.destroy();
      const W = Math.max(1, Math.floor(w * dpr));
      const H = Math.max(1, Math.floor(h * dpr));
      sceneTex = makeTex(W, H);
      bloomA = makeTex(Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4)));
      bloomB = makeTex(Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4)));
    }

    const uniData = new Float32Array(UNI_FLOATS);
    const anchorData = new Float32Array(MAX_ANCHORS * 6);
    const linkData = new Float32Array(MAX_LINKS * 2 * 3);

    const renderer: SpaceRenderer = {
      backend: 'webgpu',
      resize(nw, nh, ndpr) {
        w = nw;
        h = nh;
        dpr = Math.min(ndpr, q.dprCap);
        canvas.width = Math.max(1, Math.floor(w * dpr));
        canvas.height = Math.max(1, Math.floor(h * dpr));
        rebuild();
      },
      frame(t, dt, cursor, links, linkCount, anchors, anchorCount) {
        if (!sceneTex || !bloomA || !bloomB) return;
        const W = canvas.width;
        const H = canvas.height;

        uniData[0] = W;
        uniData[1] = H;
        uniData[2] = t;
        uniData[3] = dt;
        uniData[4] = cursor.x;
        uniData[5] = 1 - cursor.y;
        uniData[6] = 0.7 + cursor.down * 1.6;
        uniData[7] = dustCount;
        uniData[8] = dpr;
        uniData[9] = q.bloom ? 1 : 0;
        device.queue.writeBuffer(uni, 0, uniData);

        const nA = Math.min(anchorCount, MAX_ANCHORS);
        for (let i = 0; i < nA; i++) {
          anchorData[i * 6] = anchors[i * 8];
          anchorData[i * 6 + 1] = 1 - anchors[i * 8 + 1];
          anchorData[i * 6 + 2] = anchors[i * 8 + 4];
          anchorData[i * 6 + 3] = anchors[i * 8 + 5];
          anchorData[i * 6 + 4] = anchors[i * 8 + 6];
          anchorData[i * 6 + 5] = anchors[i * 8 + 7];
        }
        if (nA > 0) device.queue.writeBuffer(anchorBuf, 0, anchorData, 0, nA * 6);

        const nL = Math.min(linkCount, MAX_LINKS);
        for (let i = 0; i < nL; i++) {
          const s = links[i * 5 + 4];
          linkData[i * 6] = links[i * 5];
          linkData[i * 6 + 1] = 1 - links[i * 5 + 1];
          linkData[i * 6 + 2] = s;
          linkData[i * 6 + 3] = links[i * 5 + 2];
          linkData[i * 6 + 4] = 1 - links[i * 5 + 3];
          linkData[i * 6 + 5] = s;
        }
        if (nL > 0) device.queue.writeBuffer(linkBuf, 0, linkData, 0, nL * 6);

        const bgBind = device.createBindGroup({ layout: bgPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uni } }] });
        const dustBind = device.createBindGroup({
          layout: dustDraw.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dustBuf } },
            { binding: 1, resource: { buffer: uni } },
          ],
        });
        const dustComputeBind = device.createBindGroup({
          layout: dustPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dustBuf } },
            { binding: 1, resource: { buffer: uni } },
          ],
        });
        const anchorBind = device.createBindGroup({ layout: anchorPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uni } }] });
        const linkBind = device.createBindGroup({ layout: linkPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uni } }] });

        const enc = device.createCommandEncoder();

        // 1) 塵の計算
        {
          const pass = enc.beginComputePass();
          pass.setPipeline(dustPipe);
          pass.setBindGroup(0, dustComputeBind);
          pass.dispatchWorkgroups(Math.ceil(dustCount / 64));
          pass.end();
        }

        // 2) シーン
        {
          const pass = enc.beginRenderPass({
            colorAttachments: [{ view: sceneTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
          });
          pass.setPipeline(bgPipe);
          pass.setBindGroup(0, bgBind);
          pass.draw(3);

          pass.setPipeline(dustDraw);
          pass.setBindGroup(0, dustBind);
          pass.draw(6, dustCount);

          pass.setPipeline(anchorPipe);
          pass.setBindGroup(0, anchorBind);
          pass.setVertexBuffer(0, anchorBuf);
          if (nA > 0) pass.draw(6, nA);

          pass.setPipeline(linkPipe);
          pass.setBindGroup(0, linkBind);
          pass.setVertexBuffer(0, linkBuf);
          if (nL > 0) pass.draw(nL * 2);

          pass.end();
        }

        // 3) bloom
        if (q.bloom) {
          const brightBind = device.createBindGroup({
            layout: brightPipe.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: sceneTex.createView() },
            ],
          });
          {
            const pass = enc.beginRenderPass({
              colorAttachments: [{ view: bloomA.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
            });
            pass.setPipeline(brightPipe);
            pass.setBindGroup(0, brightBind);
            pass.draw(3);
            pass.end();
          }
          for (const [src, dst, dir] of [
            [bloomA, bloomB, [1, 0]],
            [bloomB, bloomA, [0, 1]],
          ] as const) {
            device.queue.writeBuffer(blurUni, 0, new Float32Array([dir[0], dir[1], 0, 0]));
            const bind = device.createBindGroup({
              layout: blurPipe.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: src.createView() },
                { binding: 2, resource: { buffer: blurUni } },
              ],
            });
            const pass = enc.beginRenderPass({
              colorAttachments: [{ view: dst.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
            });
            pass.setPipeline(blurPipe);
            pass.setBindGroup(0, bind);
            pass.draw(3);
            pass.end();
          }
        }

        // 4) 合成
        {
          device.queue.writeBuffer(compUni, 0, new Float32Array([W, H, t, q.bloom ? 0.85 : 0]));
          const bind = device.createBindGroup({
            layout: compPipe.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: sceneTex.createView() },
              { binding: 2, resource: (q.bloom ? bloomA : sceneTex).createView() },
              { binding: 3, resource: { buffer: compUni } },
            ],
          });
          const pass = enc.beginRenderPass({
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
              },
            ],
          });
          pass.setPipeline(compPipe);
          pass.setBindGroup(0, bind);
          pass.draw(3);
          pass.end();
        }

        device.queue.submit([enc.finish()]);
      },
      dispose() {
        sceneTex?.destroy();
        bloomA?.destroy();
        bloomB?.destroy();
        dustBuf.destroy();
        uni.destroy();
        device.destroy();
      },
    };

    return renderer;
  } catch {
    return null;
  }
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
