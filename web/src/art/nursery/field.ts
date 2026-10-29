/** Deterministic texture data and bounded render sizes; independent of the DOM. */
export function noiseVolume(size = 48, seed = 7129) {
  if (!Number.isInteger(size) || size < 8 || size > 64)
    throw Error("noise volume size");
  const data = new Uint8Array(size ** 3);
  let state = seed >>> 0;
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state >>> 24;
  }
  return data;
}
export function renderSize(
  width: number,
  height: number,
  dpr: number,
  budget: number,
) {
  const w = Math.max(1, Math.min(4096, Number.isFinite(width) ? width : 1));
  const h = Math.max(1, Math.min(4096, Number.isFinite(height) ? height : 1));
  const ratio = Math.min(1.35, Math.max(1, Number.isFinite(dpr) ? dpr : 1));
  const cap = Math.max(
    1,
    Math.min(900000, Number.isFinite(budget) ? budget : 1),
  );
  const scale = Math.min(ratio, Math.sqrt(cap / (w * h)));
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
  };
}
export function cameraBasis(yaw: number, pitch: number, distance: number) {
  const y = Math.max(-1.1, Math.min(1.1, Number.isFinite(yaw) ? yaw : 0));
  const p = Math.max(-0.65, Math.min(0.65, Number.isFinite(pitch) ? pitch : 0));
  const d = Math.max(
    3.5,
    Math.min(6.8, Number.isFinite(distance) ? distance : 4.8),
  );
  const sy = Math.sin(y),
    cy = Math.cos(y),
    sp = Math.sin(p),
    cp = Math.cos(p);
  return {
    origin: [sy * cp * d, sp * d, cy * cp * d],
    matrix: [cy, 0, -sy, -sy * sp, cp, -cy * sp, -sy * cp, -sp, -cy * cp],
  };
}
