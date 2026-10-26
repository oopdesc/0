/** One-line patches: the smallest correct rule extracted from a mistake. */
export interface Patch {
  id: string;
  text: string;
  concept: string;
  source: string;
  createdAt: number;
}

export function makePatch(text: string, concept: string, source: string, now = Date.now()): Patch {
  return {
    id: `p-${now.toString(36)}-${Math.abs(hashString(text)).toString(36)}`,
    text: text.slice(0, 180),
    concept,
    source,
    createdAt: now,
  };
}

export function addPatch(patches: Patch[], patch: Patch): Patch[] {
  if (patches.some((p) => p.text === patch.text && p.concept === patch.concept)) return patches;
  return [patch, ...patches].slice(0, 300);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}
