import type { ModelState } from '../domain/types';

export interface ViewState { rotation: number; zoom: number; selected: number | null; time: number }
const colors = ['#c6b499', '#c29c7c', '#8aa9a0', '#c48167', '#d8b98b', '#b8aba1', '#8eaaa9', '#d9c8aa'];

export function drawOrbit(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, stars: Float32Array, model: ModelState, view: ViewState, quality: 'auto' | 'high' | 'balanced' | 'battery'): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const count = quality === 'battery' ? 200 : quality === 'balanced' ? 500 : 900;
  for (let i = 0; i < Math.min(count, stars.length / 4); i++) {
    const x = stars[i * 4] * width; const y = stars[i * 4 + 1] * height;
    const s = stars[i * 4 + 2]; const a = stars[i * 4 + 3];
    ctx.fillStyle = `rgba(237, 226, 201, ${a * 0.7})`;
    ctx.fillRect(x, y, Math.max(0.5, s), Math.max(0.5, s));
  }
  const cx = width * 0.53; const cy = height * 0.52;
  const rMax = Math.min(width * 0.43, height * 0.84) * view.zoom;
  const sortedMax = Math.max(1, ...model.radii);
  const orbitR = model.radii.map((n, i) => rMax * (n === 0 ? 0.22 : 0.34 + 0.59 * (n / sortedMax)) + i * 3);
  // The tilted ellipses are a visual teaching projection; they are not a gravity solver.
  ctx.lineWidth = 0.75;
  orbitR.forEach((r, i) => {
    const selected = view.selected === i || model.highlightedIndex === i;
    ctx.strokeStyle = selected ? 'rgba(221, 185, 141, 0.55)' : 'rgba(213, 214, 199, 0.19)';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.37, -0.13, 0, Math.PI * 2); ctx.stroke();
  });
  const starRadius = Math.max(14, Math.min(41, Math.min(width, height) * 0.093)) * Math.min(view.zoom, 1.4);
  const halo = ctx.createRadialGradient(cx, cy, starRadius * 0.3, cx, cy, starRadius * 3.6);
  halo.addColorStop(0, 'rgba(247, 208, 148, 0.24)'); halo.addColorStop(0.28, 'rgba(209, 150, 93, 0.12)'); halo.addColorStop(1, 'rgba(159, 109, 64, 0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, starRadius * 3.6, 0, Math.PI * 2); ctx.fill();
  const sun = ctx.createRadialGradient(cx - starRadius * 0.35, cy - starRadius * 0.4, starRadius * 0.03, cx, cy, starRadius);
  sun.addColorStop(0, '#fff9e5'); sun.addColorStop(0.42, '#efd9b0'); sun.addColorStop(0.78, '#bb8e66'); sun.addColorStop(1, '#644a38');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, starRadius, 0, Math.PI * 2); ctx.fill();
  // Fine rings and crosshair give a navigational, rather than photorealistic, reading.
  ctx.strokeStyle = 'rgba(237, 219, 190, 0.13)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(cx, cy, starRadius * 1.23, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 5, cy - starRadius * 1.5); ctx.lineTo(cx + 5, cy - starRadius * 1.5); ctx.moveTo(cx, cy - starRadius * 1.5 - 5); ctx.lineTo(cx, cy - starRadius * 1.5 + 5); ctx.stroke();
  model.radii.forEach((n, i) => {
    const r = orbitR[i];
    const angle = view.rotation + i * 2.18 + 0.42 + view.time * (0.12 / Math.sqrt(Math.max(1, n)));
    const xx = Math.cos(angle) * r; const yy = Math.sin(angle) * r * 0.37;
    const x = cx + xx * Math.cos(-0.13) - yy * Math.sin(-0.13);
    const y = cy + xx * Math.sin(-0.13) + yy * Math.cos(-0.13);
    const radius = Math.max(3.8, Math.min(11, width * (0.008 + (i % 3) * 0.002)));
    const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, 0, x, y, radius);
    gradient.addColorStop(0, '#f5e6cb'); gradient.addColorStop(0.5, colors[i % colors.length]); gradient.addColorStop(1, '#222622');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    if (view.selected === i || model.highlightedIndex === i) {
      ctx.strokeStyle = 'rgba(242, 224, 194, .75)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, radius + 5, 0, Math.PI * 2); ctx.stroke();
    }
  });
}
