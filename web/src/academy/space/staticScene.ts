/**
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   https://github.com/ULuIQ12/webgpu-tsl-linkedparticles
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している（コピーではない）。
 *   クレジットの全文は THIRD_PARTY_NOTICES.md。
 */
/**
 * 最終フォールバック。WebGPU も WebGL2 も使えない環境、
 * または「動きを減らす」が有効なときに、静止した星空を 1 枚だけ描く。
 * 破綻しないことを優先し、アニメーションはしない。
 */
import type { SpaceRenderer } from './webgpu';

export function createStatic(canvas: HTMLCanvasElement): SpaceRenderer {
  const ctx = canvas.getContext('2d');
  let drawn = false;

  function draw(w: number, h: number, dpr: number) {
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // 深い背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070a11');
    g.addColorStop(0.55, '#0a0f16');
    g.addColorStop(1, '#10161f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星（決定的）
    let s = 20260901;
    const rnd = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
    const pts: { x: number; y: number; r: number; a: number; warm: number }[] = [];
    const n = Math.round(Math.min(900, (W * H) / 2600));
    for (let i = 0; i < n; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = Math.pow(rnd(), 2.4) * 1.9 * dpr + 0.3;
      const a = 0.25 + rnd() * 0.75;
      pts.push({ x, y, r, a, warm: rnd() });
    }
    for (const p of pts) {
      const warm = p.warm;
      const col = warm > 0.86 ? '255,214,170' : warm > 0.6 ? '255,246,232' : '200,218,255';
      ctx.fillStyle = `rgba(${col},${p.a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 近い星だけを細い線で結ぶ（星座の気配）
    const anchors = pts.filter((_, i) => i % 23 === 0).slice(0, 90);
    ctx.lineWidth = Math.max(0.5, dpr * 0.6);
    for (let i = 0; i < anchors.length; i++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < anchors.length; j++) {
        if (i === j) continue;
        const dx = anchors[i].x - anchors[j].x;
        const dy = anchors[i].y - anchors[j].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      const lim = Math.min(W, H) * 0.18;
      if (best >= 0 && bestD < lim * lim) {
        const alpha = 0.16 * (1 - Math.sqrt(bestD) / lim);
        ctx.strokeStyle = `rgba(132,196,204,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(anchors[i].x, anchors[i].y);
        ctx.lineTo(anchors[best].x, anchors[best].y);
        ctx.stroke();
      }
    }

    // 中心の淡い光
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.55);
    glow.addColorStop(0, 'rgba(120,160,170,0.06)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    drawn = true;
  }

  let w = 1;
  let h = 1;
  let dpr = 1;

  return {
    backend: 'static',
    resize(nw, nh, ndpr) {
      w = nw;
      h = nh;
      dpr = Math.min(ndpr, 2);
      draw(w, h, dpr);
    },
    frame() {
      if (!drawn) draw(w, h, dpr);
    },
    dispose() {
      /* canvas2d は破棄不要 */
    },
  };
}
