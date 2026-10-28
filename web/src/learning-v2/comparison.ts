/** 比較契約: 改行コードだけを LF に統一し、末尾の終端改行は一つ取り除く。
 * exact-lines は大文字小文字・Unicode・各行の空白を変更しない。
 */
export type Comparison = 'exact-lines' | 'tokens' | 'numeric';

export function textToLines(text: string): string[] {
  let value = text.replace(/\r\n?/g, '\n');
  if (value === '') return [];
  if (value.endsWith('\n')) value = value.slice(0, -1);
  return value.split('\n');
}

export function compareLines(
  actual: string[], expected: string[], mode: Comparison = 'exact-lines', tolerance?: number,
): boolean {
  if (mode === 'tokens') {
    const tokens = (lines: string[]) => lines.join('\n').trim().split(/\s+/u).filter(Boolean);
    const a = tokens(actual), e = tokens(expected);
    return a.length === e.length && a.every((x, i) => x === e[i]);
  }
  if (mode === 'numeric') {
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0) return false;
    const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    return actual.length === expected.length && actual.every((x, i) => {
      const y = expected[i];
      if (typeof y !== 'string' || !number.test(x) || !number.test(y)) return false;
      const a = Number(x), b = Number(y);
      return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
    });
  }
  return actual.length === expected.length && actual.every((line, i) => line === expected[i]);
}

export function compareOutput(text: string, expected: string[], mode: Comparison = 'exact-lines', tolerance?: number): boolean {
  return compareLines(textToLines(text), expected, mode, tolerance);
}
