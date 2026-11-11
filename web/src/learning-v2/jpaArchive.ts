import { zipSync, strToU8 } from "fflate";
import { siteUseNotice } from "../site-use-notice";
const paths = new Set([
  "pom.xml",
  "README.md",
  "SOLUTION.md",
  "src/main/java/zero/jpa/Author.java",
  "src/main/java/zero/jpa/Book.java",
  "src/main/java/zero/jpa/BookQueries.java",
  "src/test/java/zero/jpa/WorkshopTest.java",
]);
export function makeJpaArchive(raw: unknown) {
  const bundle = raw as {
    schema: string;
    files: { path: string; content: string }[];
  };
  if (
    !bundle ||
    bundle.schema !== "zero-jpa-workshop/1" ||
    !Array.isArray(bundle.files) ||
    bundle.files.length !== paths.size
  )
    throw Error("JPA教材の形式を確認できません。");
  const files: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  for (const f of bundle.files) {
    if (
      !f ||
      !paths.has(f.path) ||
      f.path in files ||
      typeof f.content !== "string"
    )
      throw Error("JPA教材のパスを確認できません。");
    const bytes = strToU8(f.content);
    total += bytes.length;
    if (bytes.length > 50000 || total > 100000)
      throw Error("JPA教材の容量を確認できません。");
    files[f.path] = bytes;
  }
  files["COPYRIGHT.txt"] = strToU8(siteUseNotice);
  return zipSync(files, { level: 6, mtime: new Date("2026-11-11T00:00:00Z") });
}
export async function fetchJpaArchive() {
  const response = await fetch("/learning-v2/jpa-workshop.json");
  if (!response.ok) throw Error("JPA教材を取得できません。");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 150000)
    throw Error("JPA教材が大きすぎます。");
  return makeJpaArchive(JSON.parse(text));
}
