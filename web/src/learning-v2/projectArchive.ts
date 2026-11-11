import { strToU8, zipSync } from "fflate";
import { siteUseNotice } from "../site-use-notice";

type BundleFile = { path: string; content: string };
type Bundle = {
  schema: "zero-starter-bundle/1";
  missionId: string;
  files: BundleFile[];
};
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const validPath = (s: string, language: string) =>
  s === "README-START.md" ||
  (language === "java"
    ? /^backend\/java-learning-v2\/(?:pom\.xml|README\.md|src\/(?:main|test)\/java\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.java)$/.test(
        s,
      )
    : /^projects\/rust\/book-api-http\/(?:Cargo\.(?:toml|lock)|README\.md|src\/[A-Za-z0-9_-]+\.rs)$/.test(
        s,
      ));

/** A user-initiated, local archive of a small allowlisted source bundle; no code is executed. */
export function makeProjectArchive(
  input: unknown,
  expectedMission: string,
  edits: Readonly<Record<string, string>> = {},
): Uint8Array {
  const language = /^(java|rust):mission-[A-Za-z0-9._-]{1,80}$/.exec(
    expectedMission,
  )?.[1];
  if (!language) throw new Error("課題の言語またはIDが不正です。");
  if (
    !isRecord(input) ||
    input.schema !== "zero-starter-bundle/1" ||
    input.missionId !== expectedMission ||
    !Array.isArray(input.files) ||
    !input.files.length ||
    input.files.length > 50
  )
    throw new Error("課題のファイル一覧が不正です。");
  if (!isRecord(edits) || Object.keys(edits).length > 50)
    throw new Error("下書きの一覧が不正です。");
  for (const [name, text] of Object.entries(edits)) {
    if (
      !validPath(name, language) ||
      !/\.(java|rs)$/.test(name) ||
      !input.files.some((f) => isRecord(f) && f.path === name) ||
      typeof text !== "string"
    )
      throw new Error("開始状態にない下書きファイルは追加できません。");
  }
  const data: Record<string, Uint8Array> = Object.create(null);
  let bytes = 0;
  for (const f of input.files) {
    if (
      !isRecord(f) ||
      typeof f.path !== "string" ||
      !validPath(f.path, language) ||
      f.path in data ||
      typeof f.content !== "string"
    )
      throw new Error("課題ファイルのパスまたは内容が不正です。");
    const content = strToU8(
      Object.hasOwn(edits, f.path) ? edits[f.path] : f.content,
    );
    bytes += content.length;
    if (content.length > 200_000 || bytes > 1_000_000)
      throw new Error("課題のファイルが大きすぎます。");
    data[f.path] = content;
  }
  const bundle = input as Bundle;
  if (!bundle.files.some((f) => f.path === "README-START.md"))
    throw new Error("開始手順がありません。");
  data["COPYRIGHT.txt"] = strToU8(siteUseNotice);
  if (Object.keys(edits).length)
    data["WORK-IN-PROGRESS.md"] = strToU8(
      "# 作業中の下書き・未実行\n\nこのZIPは開始状態へ画面上の下書きを組み込んだものです。実行・コンパイル・テストの成功を保証しません。README-START.mdの手順で実際に確認してください。\n\n変更ファイル:\n" +
        Object.keys(edits)
          .map((name) => "- " + name)
          .join("\n") +
        "\n",
    );
  return zipSync(data, { level: 6, mtime: new Date("2026-10-28T00:00:00Z") });
}

export async function fetchProjectArchive(
  missionId: string,
  signal?: AbortSignal,
  edits?: Readonly<Record<string, string>>,
): Promise<Uint8Array> {
  const language = /^(java|rust):mission-[A-Za-z0-9._-]{1,80}$/.exec(
    missionId,
  )?.[1];
  if (!language) throw new Error("小課題のIDが不正です。");
  const name = encodeURIComponent(missionId.slice(language.length + 1));
  const response = await fetch(
    `/learning-v2/${language}/examples/projects/${name}.json`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      `開始ファイルを読み込めません（HTTP ${response.status}）。`,
    );
  if (Number(response.headers.get("content-length") || 0) > 1_500_000)
    throw new Error("開始ファイルが大きすぎます。");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1_500_000)
    throw new Error("開始ファイルが大きすぎます。");
  let bundle: unknown;
  try {
    bundle = JSON.parse(text) as unknown;
  } catch {
    throw new Error("開始ファイルを読み取れません。");
  }
  return makeProjectArchive(bundle, missionId, edits);
}
