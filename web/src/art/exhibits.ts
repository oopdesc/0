export const ART_EXHIBITS = [
  ["solar", "太陽系と惑星", "惑星の姿と公転を観察する。", "01"],
  ["galaxy", "銀河とブラックホール", "星の円盤を、あらゆる角度から。", "02"],
  ["orbit", "光と軌道", "金色の星雲に浮かぶ、動く模型。", "03"],
  ["nebula", "星雲の奥へ", "雲の重なりと、遠くの星の光。", "04"],
] as const;
export type ExhibitId = typeof ART_EXHIBITS[number][0] | "observation";
export function readExhibit(search: string): ExhibitId {
  const q = new URLSearchParams(search);
  const selected = q.get("exhibit");
  if (selected === "celestial") return "galaxy";
  if (selected === "particles") return "nebula";
  if (selected === "observation") return selected;
  for (const [id] of ART_EXHIBITS) if (id === selected) return id;
  if (q.get("view") === "observation" || q.get("view") === "photo") return "observation";
  if (q.has("scene") || q.has("view") || q.get("model") === "galaxy") return "galaxy";
  return "solar";
}
