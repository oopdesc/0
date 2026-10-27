/**
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   https://github.com/ULuIQ12/webgpu-tsl-linkedparticles
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している（コピーではない）。
 *   クレジットの全文は THIRD_PARTY_NOTICES.md。
 */
/**
 * 端末の実力を測って粒子数を決める。
 * 解像度・DPR・フレーム時間を実測し、重ければ自動で 1 段下げる。
 * 「Lighthouse のスコア」ではなく、実際に測った値だけを使う。
 */
export type Tier = 'ultra' | 'high' | 'balanced' | 'battery';

export interface Quality {
  tier: Tier;
  count: number;
  dprCap: number;
  bloom: boolean;
  dust: number;
}

const PRESETS: Record<Tier, Quality> = {
  ultra: { tier: 'ultra', count: 1152, dprCap: 2, bloom: true, dust: 16384 },
  high: { tier: 'high', count: 896, dprCap: 1.75, bloom: true, dust: 8192 },
  balanced: { tier: 'balanced', count: 640, dprCap: 1.5, bloom: true, dust: 4096 },
  battery: { tier: 'battery', count: 384, dprCap: 1, bloom: false, dust: 1536 },
};

export function preset(tier: Tier): Quality {
  return PRESETS[tier];
}

export function autoTier(): Tier {
  if (typeof navigator === 'undefined') return 'balanced';
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return 'battery';
  if (mobile) return cores >= 8 && mem >= 4 ? 'balanced' : 'battery';
  if (cores >= 8 && mem >= 8) return 'balanced';
  if (cores >= 4) return 'balanced';
  return 'balanced';
}

/** 実際のフレーム時間から段階を下げる（1 回だけ、慎重に） */
export function degrade(q: Quality): Quality | null {
  const order: Tier[] = ['ultra', 'high', 'balanced', 'battery'];
  const i = order.indexOf(q.tier);
  if (i < 0 || i === order.length - 1) return null;
  return PRESETS[order[i + 1]];
}

export class FrameMeter {
  private samples: number[] = [];
  private last = 0;
  push(now: number): void {
    if (this.last) this.samples.push(now - this.last);
    this.last = now;
    if (this.samples.length > 90) this.samples.shift();
  }
  get avg(): number {
    if (!this.samples.length) return 16.7;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
  get slow(): boolean {
    const s = this.samples.slice(-45);
    if (s.length < 45) return false;
    return s.reduce((a, b) => a + b, 0) / s.length > 26; // 約 38fps 未満
  }
  reset(): void {
    this.samples = [];
    this.last = 0;
  }
}
