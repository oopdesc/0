export const ART_EXHIBITS = [
  ["solar", "太陽系と惑星", "惑星の姿と公転を観察する。", "01"],
  ["celestial", "星のアトリエ・新作", "銀河・星雲・軌道を、新しい描画で。", "02"],
  ["galaxy", "銀河とブラックホール", "星の円盤を、あらゆる角度から。", "03"],
  ["orbit", "光と軌道", "金色の星雲に浮かぶ、動く模型。", "04"],
  ["nebula", "星雲の奥へ", "雲の重なりと、遠くの星の光。", "05"],
  ["particles", "流れる星塵", "指先で引き寄せる、星の流れ。", "06"],
] as const;
export type ExhibitId = typeof ART_EXHIBITS[number][0] | "observation";
export function readExhibit(search: string): ExhibitId {
  const q = new URLSearchParams(search);
  const selected = q.get("exhibit");
  if (selected === "observation") return selected;
  for (const [id] of ART_EXHIBITS) if (id === selected) return id;
  if (q.get("view") === "observation" || q.get("view") === "photo") return "observation";
  if (q.has("scene") || q.has("view") || q.get("model") === "galaxy") return "galaxy";
  return "solar";
}
