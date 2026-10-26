export type ArtSettings = {
  mode: number;
  id: string;
  seed: number;
  tilt: number;
  exposure: number;
  speed: number;
  color: [number, number, number];
};
export type ArtScene = {
  mode: number;
  id: string;
  name: string;
  caption: string;
  description: string;
  tilt: number;
};
export type JavaArt = {
  catalog(): string;
  settings(mode: number, seed: number, tilt: number, exposure: number): string;
  indexForId(id: string): number;
  camera(zoom: number, brightness: number, x: number, y: number): string;
  orbit(azimuth: number, elevation: number, distance: number, brightness: number): string;
  run(exercise: string, input: string): string;
  reviewDays(successes: number, recalled: boolean): number;
};
let pending: Promise<JavaArt> | undefined;
/** 設定と境界判定はJavaで実行する。ここはブラウザのmoduleロード境界だけ。 */
export function loadJavaArt(): Promise<JavaArt> {
  pending ??= import("./generated/art-model.js")
    .then((module: JavaArt) => {
      const required = [
        "catalog",
        "settings",
        "indexForId",
        "camera",
        "run",
        "reviewDays",
        "orbit",
      ] as const;
      if (required.some((name) => typeof module[name] !== "function"))
        throw Error("Java model unavailable");
      return module;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
