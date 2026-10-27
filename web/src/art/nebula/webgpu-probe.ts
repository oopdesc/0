/**
 * WebGPU capability probe.
 *
 * The Space engine's primary render path is WebGL2 (see scene.ts), which
 * implements the full linked-particle technique (cursor emission, turbulence
 * flow field, nearest-neighbour links, additive blending, bloom, depth).
 *
 * WebGPU is probed here so the HUD can report honestly whether the device
 * exposes a WebGPU adapter. A WebGPU *compute* path (Three.js TSL) is the
 * upstream ambition, but it requires on-device validation of the evolving TSL
 * API (compute callbacks must return a Node; StorageBufferNode has no
 * toAttribute(); SpriteNodeMaterial uses colour nodes). Shipping an
 * unvalidated WebGPU compute pipeline that would throw and silently fall back
 * to WebGL is worse than an honest, robust WebGL2 path — so the probe reports
 * capability and the renderer stays WebGL2 until the compute path is validated
 * on real devices. See HANDOFF.md and PERFORMANCE_REPORT.md.
 */

export interface WebGPUProbe {
  available: boolean;
  reason: string;
}

export async function probeWebGPU(): Promise<WebGPUProbe> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ info?: { vendor?: string; device?: string } } | null> } }).gpu;
  if (!gpu) return { available: false, reason: 'navigator.gpu is undefined' };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { available: false, reason: 'no GPU adapter' };
    const vendor = adapter.info?.vendor ?? 'unknown';
    const device = adapter.info?.device ?? 'unknown';
    return { available: true, reason: `adapter: ${vendor} / ${device}` };
  } catch (e) {
    return { available: false, reason: `requestAdapter threw: ${String(e)}` };
  }
}
