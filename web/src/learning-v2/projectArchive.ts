import { strToU8, zipSync } from 'fflate';

type BundleFile = { path: string; content: string };
type Bundle = { schema: 'zero-starter-bundle/1'; missionId: string; files: BundleFile[] };
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validPath = (s: string) => s === 'README-START.md' || /^backend\/java-learning-v2\/(?:pom\.xml|README\.md|src\/(?:main|test)\/java\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.java)$/.test(s);

/** A user-initiated, local archive of a small allowlisted source bundle; no code is executed. */
export function makeProjectArchive(input: unknown, expectedMission: string): Uint8Array {
  if (!isRecord(input) || input.schema !== 'zero-starter-bundle/1' || input.missionId !== expectedMission || !Array.isArray(input.files) || !input.files.length || input.files.length > 50) throw new Error('課題のファイル一覧が不正です。');
  const data: Record<string, Uint8Array> = Object.create(null); let bytes = 0;
  for (const f of input.files) {
    if (!isRecord(f) || typeof f.path !== 'string' || !validPath(f.path) || f.path in data || typeof f.content !== 'string') throw new Error('課題ファイルのパスまたは内容が不正です。');
    const content = strToU8(f.content); bytes += content.length;
    if (content.length > 200_000 || bytes > 1_000_000) throw new Error('課題のファイルが大きすぎます。');
    data[f.path] = content;
  }
  const bundle = input as Bundle;
  if (!bundle.files.some(f => f.path === 'README-START.md')) throw new Error('開始手順がありません。');
  return zipSync(data, { level: 6, mtime: new Date('2026-10-28T00:00:00Z') });
}

export async function fetchProjectArchive(missionId: string, signal?: AbortSignal): Promise<Uint8Array> {
  if (!/^java:mission-[A-Za-z0-9._-]{1,80}$/.test(missionId)) throw new Error('小課題のIDが不正です。');
  const name = encodeURIComponent(missionId.slice('java:'.length));
  const response = await fetch(`/learning-v2/java/examples/projects/${name}.json`, { signal });
  if (!response.ok) throw new Error(`開始ファイルを読み込めません（HTTP ${response.status}）。`);
  if (Number(response.headers.get('content-length') || 0) > 1_500_000) throw new Error('開始ファイルが大きすぎます。');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1_500_000) throw new Error('開始ファイルが大きすぎます。');
  let bundle: unknown; try { bundle = JSON.parse(text) as unknown; } catch { throw new Error('開始ファイルを読み取れません。'); }
  return makeProjectArchive(bundle, missionId);
}
