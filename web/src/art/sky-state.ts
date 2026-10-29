export const SKY_IDS = [
  "nursery",
  "solar",
  "galaxy",
  "orbit",
  "nebula",
  "milkyway",
] as const;
export type SkyId = (typeof SKY_IDS)[number];
export const SKY_NAMES: Record<SkyId, string> = {
  nursery: "星雲の中へ",
  solar: "太陽系と惑星",
  galaxy: "銀河とブラックホール",
  orbit: "光と軌道",
  nebula: "星雲の奥へ",
  milkyway: "天の川の内側",
};
export const SKY_KEY = "0.background.v1";
export type SkyState = {
  schema: 1;
  global: SkyId | null;
  pages: Record<string, SkyId>;
  strength: number;
  paused: boolean;
};
export const emptySky = (): SkyState => ({
  schema: 1,
  global: null,
  pages: {},
  strength: 24,
  paused: false,
});
const paths = new Set([
  "/",
  "/learn",
  "/art",
  "/lab",
  "/code",
  "/aichat",
  "/excelvba",
  "/contact",
  "/privacy",
  "/accessibility",
  "/settings",
  "/game",
  "/cosmicGameV3",
  "/free-book",
]);
export function skyId(x: unknown): x is SkyId {
  return typeof x === "string" && (SKY_IDS as readonly string[]).includes(x);
}
export function validateSky(x: unknown): SkyState {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw Error("背景設定の形式が不正です。");
  const v = x as Record<string, unknown>;
  if (
    v.schema !== 1 ||
    !(v.global === null || skyId(v.global)) ||
    typeof v.strength !== "number" ||
    !Number.isInteger(v.strength) ||
    v.strength < 8 ||
    v.strength > 72 ||
    typeof v.paused !== "boolean" ||
    !v.pages ||
    typeof v.pages !== "object" ||
    Array.isArray(v.pages) ||
    Object.keys(v.pages).length > paths.size
  )
    throw Error("背景設定の値が不正です。");
  const pages: Record<string, SkyId> = {};
  for (const [k, id] of Object.entries(v.pages)) {
    if (!paths.has(k) || !skyId(id)) throw Error("背景の適用先が不正です。");
    pages[k] = id;
  }
  return {
    schema: 1,
    global: v.global,
    pages,
    strength: v.strength,
    paused: v.paused,
  };
}
export function readSky(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(SKY_KEY);
    if (raw && raw.length > 8000) throw Error("背景設定が大きすぎます。");
    return {
      state: raw ? validateSky(JSON.parse(raw)) : emptySky(),
      writable: true,
    };
  } catch {
    return { state: emptySky(), writable: false };
  }
}
export function activeSky(s: SkyState, path: string) {
  return s.pages[path] ?? s.global;
}
export function chooseSky(
  s: SkyState,
  path: string,
  id: SkyId,
  scope: "all" | "page",
): SkyState {
  if (!paths.has(path) || !skyId(id)) throw Error("背景の適用先が不正です。");
  return validateSky(
    scope === "all"
      ? { ...s, global: id, pages: {} }
      : { ...s, pages: { ...s.pages, [path]: id } },
  );
}
