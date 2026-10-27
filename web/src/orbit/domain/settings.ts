export type Quality = 'auto' | 'high' | 'balanced' | 'battery';
export interface Settings { quality: Quality; speed: 0.5 | 1 | 2 }
const KEY = 'orbit-code-settings-v1';
export function loadSettings(): Settings {
  const fallback: Settings = { quality: 'auto', speed: 1 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw || raw.length > 1000) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const record = value as Record<string, unknown>;
    return {
      quality: record.quality === 'high' || record.quality === 'balanced' || record.quality === 'battery' ? record.quality : 'auto',
      speed: record.speed === 0.5 || record.speed === 2 ? record.speed : 1,
    };
  } catch { return fallback; }
}
export function saveSettings(settings: Settings): boolean {
  try { window.localStorage.setItem(KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
