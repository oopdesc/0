/**
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   https://github.com/ULuIQ12/webgpu-tsl-linkedparticles
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している（コピーではない）。
 *   クレジットの全文は THIRD_PARTY_NOTICES.md。
 */
/**
 * WebGL2 バックエンド（WebGPU が無い環境向け）。
 * WebGPU 版と同じ見た目を、計算シェーダを使わずに作る。
 * 粒子そのものは Rust/wasm が計算済みなので、ここは描画だけを担当する。
 */
import type { Quality } from './quality';
import type { SpaceRenderer } from './webgpu';

const VS_BG = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_BG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCursor;
out vec4 fragColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    amp *= 0.5;
  }
  return v;
}
vec3 starLayer(vec2 p, float scale, float size, float bright, vec2 drift) {
  vec2 q = p * scale + drift;
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float rnd = hash21(cell);
  if (rnd < 0.86) return vec3(0.0);
  vec2 off = vec2(hash21(cell + 3.7), hash21(cell + 9.1)) - 0.5;
  float d = length(f - off * 0.7);
  float core = smoothstep(size, 0.0, d);
  float temp = hash21(cell + 21.0);
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.94, 0.84), temp);
  tint = mix(tint, vec3(1.0, 0.78, 0.58), smoothstep(0.93, 1.0, temp));
  float twinkle = 0.82 + 0.18 * sin(uTime * (0.6 + temp * 1.7) + rnd * 40.0);
  return tint * core * bright * twinkle;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;
  vec2 par = (uCursor - 0.5) * 0.05;
  vec3 col = mix(vec3(0.010, 0.013, 0.022), vec3(0.028, 0.032, 0.046), uv.y);
  vec2 q = (p + par) * 1.45 + vec2(uTime * 0.0045, -uTime * 0.0032);
  vec2 warp = vec2(fbm(q * 1.7), fbm(q * 1.7 + vec2(4.7, 2.3)));
  float n = fbm(q + warp * 1.35);
  float lanes = fbm(q * 3.1 + warp * 2.0);
  float dust = smoothstep(0.38, 0.86, n);
  float fine = smoothstep(0.55, 0.95, lanes);
  col += vec3(0.055, 0.105, 0.118) * dust * 0.75;
  col += vec3(0.150, 0.112, 0.062) * pow(dust, 2.2) * 0.55;
  col += vec3(0.020, 0.030, 0.055) * fine * 0.6;
  float r = length(p - par * 2.0);
  col += vec3(0.030, 0.036, 0.042) * exp(-r * 2.6);
  col += starLayer(p, 22.0, 0.10, 0.55, par * 0.4);
  col += starLayer(p, 13.0, 0.13, 0.85, par * 0.9 + vec2(3.1, 7.7));
  col += starLayer(p, 8.0, 0.16, 1.15, par * 1.6 + vec2(11.3, 2.9));
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(col, 1.0);
}`;

const VS_PARTICLE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aXY;
layout(location=2) in vec4 aMisc;   // life, seed, size, glow
uniform vec2 uRes;
uniform float uDpr;
uniform float uScale;
out vec2 vUv;
out float vBright;
out float vSeed;
void main() {
  float size = aMisc.z * uDpr * uScale;
  vec2 clip = (aXY * uRes - uRes * 0.5) * 2.0 / uRes.y;
  vec2 px = aCorner * size * 2.0 / uRes.y;
  gl_Position = vec4(clip + px, 0.0, 1.0);
  vUv = aCorner;
  vBright = aMisc.x * aMisc.w;
  vSeed = aMisc.y;
}`;

const FS_PARTICLE = `#version 300 es
precision highp float;
in vec2 vUv;
in float vBright;
in float vSeed;
out vec4 fragColor;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float core = smoothstep(1.0, 0.0, r);
  float halo = pow(core, 5.0);
  vec3 tint = mix(vec3(0.70, 0.88, 1.0), vec3(1.0, 0.92, 0.78), fract(vSeed * 7.3));
  vec3 c = tint * (halo * 1.5 + core * 0.32) * max(vBright, 0.0);
  fragColor = vec4(c, 1.0);
}`;

const VS_LINE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aXY;
layout(location=1) in float aStrength;
uniform vec2 uRes;
out float vStrength;
void main() {
  vec2 clip = (aXY * uRes - uRes * 0.5) * 2.0 / uRes.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vStrength = aStrength;
}`;

const FS_LINE = `#version 300 es
precision highp float;
in float vStrength;
out vec4 fragColor;
void main() {
  vec3 c = vec3(0.42, 0.72, 0.78) * vStrength * 0.55;
  fragColor = vec4(c, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? '';
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('program');
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? '';
    gl.deleteProgram(p);
    throw new Error(`program link failed: ${log}`);
  }
  return p;
}

export function createWebGL2(canvas: HTMLCanvasElement, q: Quality): SpaceRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  let bg: WebGLProgram;
  let part: WebGLProgram;
  let line: WebGLProgram;
  try {
    bg = program(gl, VS_BG, FS_BG);
    part = program(gl, VS_PARTICLE, FS_PARTICLE);
    line = program(gl, VS_LINE, FS_LINE);
  } catch {
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const anchorBuf = gl.createBuffer();
  const linkBuf = gl.createBuffer();
  const emptyVao = gl.createVertexArray();
  const anchorVao = gl.createVertexArray();
  const linkVao = gl.createVertexArray();

  const loc = (p: WebGLProgram, name: string) => gl.getAttribLocation(p, name);
  const uloc = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);

  // anchor VAO
  gl.bindVertexArray(anchorVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, anchorBuf);
  const aXY = loc(part, 'aXY');
  const aMisc = loc(part, 'aMisc');
  gl.enableVertexAttribArray(aXY);
  gl.vertexAttribPointer(aXY, 2, gl.FLOAT, false, 24, 0);
  gl.vertexAttribDivisor(aXY, 1);
  gl.enableVertexAttribArray(aMisc);
  gl.vertexAttribPointer(aMisc, 4, gl.FLOAT, false, 24, 8);
  gl.vertexAttribDivisor(aMisc, 1);

  // link VAO
  gl.bindVertexArray(linkVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuf);
  const lXY = loc(line, 'aXY');
  const lS = loc(line, 'aStrength');
  gl.enableVertexAttribArray(lXY);
  gl.vertexAttribPointer(lXY, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(lS);
  gl.vertexAttribPointer(lS, 1, gl.FLOAT, false, 12, 8);

  gl.bindVertexArray(null);
  void emptyVao;

  let w = 1;
  let h = 1;
  let dpr = 1;
  let anchorData = new Float32Array(0);
  let linkData = new Float32Array(0);
  let anchorCount = 0;
  let linkCount = 0;

  return {
    backend: 'webgl2',
    resize(nw, nh, ndpr) {
      w = nw;
      h = nh;
      dpr = Math.min(ndpr, q.dprCap);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    frame(t, _dt, cursor, links, nLinks, anchors, nAnchors) {
      const W = canvas.width;
      const H = canvas.height;

      if (anchorData.length < nAnchors * 6) anchorData = new Float32Array(Math.max(nAnchors * 6, 256));
      for (let i = 0; i < nAnchors; i++) {
        anchorData[i * 6] = anchors[i * 8];
        anchorData[i * 6 + 1] = 1 - anchors[i * 8 + 1];
        anchorData[i * 6 + 2] = anchors[i * 8 + 4];
        anchorData[i * 6 + 3] = anchors[i * 8 + 5];
        anchorData[i * 6 + 4] = anchors[i * 8 + 6];
        anchorData[i * 6 + 5] = anchors[i * 8 + 7];
      }
      anchorCount = nAnchors;
      gl.bindBuffer(gl.ARRAY_BUFFER, anchorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, anchorData.subarray(0, nAnchors * 6), gl.DYNAMIC_DRAW);

      if (linkData.length < nLinks * 6) linkData = new Float32Array(Math.max(nLinks * 6, 256));
      for (let i = 0; i < nLinks; i++) {
        const s = links[i * 5 + 4];
        linkData[i * 6] = links[i * 5];
        linkData[i * 6 + 1] = 1 - links[i * 5 + 1];
        linkData[i * 6 + 2] = s;
        linkData[i * 6 + 3] = links[i * 5 + 2];
        linkData[i * 6 + 4] = 1 - links[i * 5 + 3];
        linkData[i * 6 + 5] = s;
      }
      linkCount = nLinks;
      gl.bindBuffer(gl.ARRAY_BUFFER, linkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, linkData.subarray(0, nLinks * 6), gl.DYNAMIC_DRAW);

      // 背景
      gl.disable(gl.BLEND);
      gl.useProgram(bg);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(uloc(bg, 'uRes'), W, H);
      gl.uniform1f(uloc(bg, 'uTime'), t);
      gl.uniform2f(uloc(bg, 'uCursor'), cursor.x, 1 - cursor.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 加算合成
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

      // リンク
      if (linkCount > 0) {
        gl.useProgram(line);
        gl.bindVertexArray(linkVao);
        gl.uniform2f(uloc(line, 'uRes'), W, H);
        gl.drawArrays(gl.LINES, 0, linkCount * 2);
      }

      // 粒子
      if (anchorCount > 0) {
        gl.useProgram(part);
        gl.bindVertexArray(anchorVao);
        gl.uniform2f(uloc(part, 'uRes'), W, H);
        gl.uniform1f(uloc(part, 'uDpr'), dpr);
        gl.uniform1f(uloc(part, 'uScale'), 2.2);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, anchorCount);
      }

      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    },
    dispose() {
      gl.deleteProgram(bg);
      gl.deleteProgram(part);
      gl.deleteProgram(line);
      gl.deleteBuffer(quad);
      gl.deleteBuffer(anchorBuf);
      gl.deleteBuffer(linkBuf);
      gl.deleteVertexArray(emptyVao);
      gl.deleteVertexArray(anchorVao);
      gl.deleteVertexArray(linkVao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
