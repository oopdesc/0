import { strToU8, zipSync } from "fflate";
import { siteUseNotice } from "../site-use-notice";
const paths = new Set([
  "README-START.md",
  "SOLUTION.md",
  "workplace-java/BookService.java",
  "workplace-java/WorkplaceTest.java",
  "workplace-rust/Cargo.toml",
  "workplace-rust/src/lib.rs",
]);
export function makeWorkplaceArchive(raw: unknown): Uint8Array {
  const bundle = raw as {
    schema: string;
    files: { path: string; content: string }[];
  };
  if (
    !bundle ||
    bundle.schema !== "zero-workplace-starter/1" ||
    !Array.isArray(bundle.files) ||
    bundle.files.length !== paths.size
  )
    throw Error("実務課題のファイル一覧を確認できません。");
  const files: Record<string, Uint8Array> = Object.create(null);
  let bytes = 0;
  for (const f of bundle.files) {
    if (
      !f ||
      !paths.has(f.path) ||
      f.path in files ||
      typeof f.content !== "string"
    )
      throw Error("実務課題のパスまたは内容が不正です。");
    const content = strToU8(f.content);
    bytes += content.length;
    if (content.length > 50000 || bytes > 100000)
      throw Error("実務課題の容量を確認できません。");
    files[f.path] = content;
  }
  files["COPYRIGHT.txt"] = strToU8(siteUseNotice);
  return zipSync(files, { level: 6, mtime: new Date("2026-11-11T00:00:00Z") });
}
export async function fetchWorkplaceArchive(): Promise<Uint8Array> {
  const response = await fetch("/learning-v2/workplace-starter.json");
  if (!response.ok) throw Error("実務課題を取得できません。");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 150000)
    throw Error("実務課題が大きすぎます。");
  return makeWorkplaceArchive(JSON.parse(text));
}
