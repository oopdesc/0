import type { Question } from './types';

type RunnerStatus = 'passed' | 'failed' | 'compile-error' | 'runtime-error' | 'timeout' | 'unsupported' | 'not-run';
export type LocalGradeCase = { id: string; status: string; actual: { stdout: string[]; exitCode: number | null }; expectedComparison: { expected: string[]; matched: boolean } };
export type LocalGradeResult = { status: RunnerStatus; cases: LocalGradeCase[]; diagnostics: string[]; toolchain: { javac?: string; java?: string; rustc?: string; target?: string } | null };
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const statuses: RunnerStatus[] = ['passed', 'failed', 'compile-error', 'runtime-error', 'timeout', 'unsupported', 'not-run'];
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 1000 && x.every(y => typeof y === 'string' && y.length <= 65536);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** No network request: only the explicitly started loopback server injects this marker. */
export function localGradeToken(location: Pick<Location, 'protocol' | 'hostname'>, document: Pick<Document, 'querySelector'>): string | null {
  if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') return null;
  const token = document.querySelector('meta[name="zero-java-local"]')?.getAttribute('content');
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}

/** Bind any usable result to the exact submitted source and fixed test set.
 * A claimed pass also needs every actual case and expected line to agree. */
export async function validateLocalResult(q: Question, source: string, value: unknown): Promise<LocalGradeResult> {
  if (!isObject(value) || !statuses.includes(value.status as RunnerStatus) || !Array.isArray(value.cases) || value.cases.length > 32 || !strings(value.diagnostics)) throw new Error('ローカル採点の結果形式が不正です。');
  const tests = q.tests.filter(t => t.id === 'default');
  if (tests.length !== 1) throw new Error('固定テストの形式が不正です。');
  const sourceDigest = await sha256(JSON.stringify([{ path: q.language === 'rust' ? 'main.rs' : 'Main.java', content: source }]));
  const testsDigest = await sha256(JSON.stringify(tests[0]));
  if ((value.sourceDigest !== null && value.sourceDigest !== sourceDigest) || (value.testsDigest !== null && value.testsDigest !== testsDigest)) throw new Error('コードまたは固定テストが現在の画面と異なるため、結果を使いません。');
  if (!['unsupported', 'not-run'].includes(value.status as string) && (value.sourceDigest !== sourceDigest || value.testsDigest !== testsDigest)) throw new Error('結果とコード・固定テストの照合ができません。');
  const cases: LocalGradeCase[] = value.cases.map(item => {
    if (!isObject(item) || typeof item.id !== 'string' || item.id.length > 200 || typeof item.status !== 'string' || !statuses.includes(item.status as RunnerStatus) || !isObject(item.actual) || !strings(item.actual.stdout) || !(item.actual.exitCode === null || Number.isInteger(item.actual.exitCode)) || !isObject(item.expectedComparison) || !strings(item.expectedComparison.expected) || typeof item.expectedComparison.matched !== 'boolean') throw new Error('個別テスト結果の形式が不正です。');
    return { id: item.id, status: item.status, actual: { stdout: item.actual.stdout, exitCode: item.actual.exitCode as number | null }, expectedComparison: { expected: item.expectedComparison.expected, matched: item.expectedComparison.matched } };
  });
  if (value.status === 'passed' && (cases.length !== tests[0].cases.length || !cases.every((c, i) => c.id === tests[0].cases[i].id && c.status === 'passed' && c.actual.exitCode === 0 && c.expectedComparison.matched && same(c.actual.stdout, tests[0].cases[i].expectedStdout) && same(c.expectedComparison.expected, tests[0].cases[i].expectedStdout)))) throw new Error('全固定テストの実測が一致しないため、合格にしません。');
  const toolchain = isObject(value.toolchain) ? {
    ...(typeof value.toolchain.javac === 'string' ? { javac: value.toolchain.javac.slice(0, 500) } : {}),
    ...(typeof value.toolchain.java === 'string' ? { java: value.toolchain.java.slice(0, 500) } : {}),
    ...(typeof value.toolchain.rustc === 'string' ? { rustc: value.toolchain.rustc.slice(0, 500) } : {}),
    ...(typeof value.toolchain.target === 'string' ? { target: value.toolchain.target.slice(0, 100) } : {}),
  } : null;
  return { status: value.status as RunnerStatus, cases, diagnostics: value.diagnostics.map(s => s.slice(0, 8192)), toolchain };
}

/** Called only after an explicit button click; always same origin, never localhost from a public site. */
export async function runLocalGrade(q: Question, packVersion: string, source: string, token: string, signal: AbortSignal): Promise<LocalGradeResult> {
  if (!['java','rust'].includes(q.language) || !q.writingRequired || !new RegExp(`^${q.language}:[A-Za-z0-9._-]{1,120}$`).test(q.id) || !/^[A-Za-z0-9._-]{1,64}$/.test(packVersion) || !/^[a-f0-9]{64}$/.test(token) || new TextEncoder().encode(source).byteLength > 65536) throw new Error('このコードはローカル採点の条件に合いません。');
  const response = await fetch(`/__zero_local/${q.language}/grade`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-Zero-Local-Token': token },
    body: JSON.stringify({ exerciseId: q.id, packVersion, files: [{ path: q.language === 'rust' ? 'main.rs' : 'Main.java', content: source }], testSetId: 'default' }),
  });
  if (!response.ok) throw new Error(`ローカル採点へ送れません（HTTP ${response.status}）。`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 262144) throw new Error('ローカル採点の結果が大きすぎます。');
  let result: unknown; try { result = JSON.parse(text) as unknown; } catch { throw new Error('ローカル採点の結果を読めません。'); }
  return validateLocalResult(q, source, result);
}
