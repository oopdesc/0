import type { LessonId, ModelState, RunResult, TraceStep } from './types';
import { getLesson } from './lessons';

// This is intentionally a closed, bounded interpreter for four documented patterns.
// It is NOT a Java VM or a Rust compiler. Unrecognized text is rejected, never eval'd.
export const MAX_CODE_LENGTH = 3000;
const listCapture = '(\\d+(?:\\s*,\\s*\\d+)*)';
const javaArrayPattern = new RegExp(`^int\\s*\\[\\s*\\]\\s+orbits\\s*=\\s*\\{\\s*${listCapture}\\s*\\}\\s*;\\s*int\\s+count\\s*=\\s*0\\s*;\\s*for\\s*\\(\\s*int\\s+i\\s*=\\s*([01])\\s*;\\s*i\\s*(<=|<)\\s*orbits\\s*\\.\\s*length\\s*;\\s*i\\s*\\+\\+\\s*\\)\\s*\\{\\s*int\\s+orbit\\s*=\\s*orbits\\s*\\[\\s*i\\s*\\]\\s*;\\s*count\\s*\\+\\+\\s*;\\s*\\}\\s*System\\s*\\.\\s*out\\s*\\.\\s*println\\s*\\(\\s*count\\s*\\)\\s*;$`);
const javaStreamPattern = new RegExp(`^List\\s*<\\s*Integer\\s*>\\s+radii\\s*=\\s*List\\s*\\.\\s*of\\s*\\(\\s*${listCapture}\\s*\\)\\s*;\\s*long\\s+count\\s*=\\s*radii\\s*\\.\\s*stream\\s*\\(\\s*\\)\\s*\\.\\s*filter\\s*\\(\\s*radius\\s*->\\s*radius\\s*(>=|<=|==|>|<)\\s*(\\d+)\\s*\\)\\s*\\.\\s*count\\s*\\(\\s*\\)\\s*;\\s*System\\s*\\.\\s*out\\s*\\.\\s*println\\s*\\(\\s*count\\s*\\)\\s*;$`);
const rustOwnershipPattern = new RegExp(`^let\\s+stars\\s*=\\s*vec!\\s*\\[\\s*${listCapture}\\s*\\]\\s*;\\s*let\\s+view\\s*=\\s*(&\\s*stars|stars\\s*\\.\\s*clone\\s*\\(\\s*\\)|stars)\\s*;\\s*println!\\s*\\(\\s*"\\{\\}"\\s*,\\s*view\\s*\\.\\s*len\\s*\\(\\s*\\)\\s*\\)\\s*;\\s*println!\\s*\\(\\s*"\\{\\}"\\s*,\\s*stars\\s*\\.\\s*len\\s*\\(\\s*\\)\\s*\\)\\s*;$`);
const rustOptionPattern = new RegExp(`^let\\s+orbits\\s*=\\s*vec!\\s*\\[\\s*${listCapture}\\s*\\]\\s*;\\s*let\\s+index\\s*:\\s*usize\\s*=\\s*(\\d+)\\s*;\\s*match\\s+orbits\\s*\\.\\s*get\\s*\\(\\s*index\\s*\\)\\s*\\{\\s*Some\\s*\\(\\s*radius\\s*\\)\\s*=>\\s*println!\\s*\\(\\s*"\\{\\}"\\s*,\\s*radius\\s*\\)\\s*,\\s*None\\s*=>\\s*println!\\s*\\(\\s*"none"\\s*\\)\\s*,?\\s*\\}\\s*$`);


const javaPolyPattern = /^interface\s+Body\s*\{\s*String\s+kind\s*\(\s*\)\s*;\s*\}\s*class\s+Planet\s+implements\s+Body\s*\{\s*public\s+String\s+kind\s*\(\s*\)\s*\{\s*return\s+"planet"\s*;\s*\}\s*\}\s*class\s+Star\s+implements\s+Body\s*\{\s*public\s+String\s+kind\s*\(\s*\)\s*\{\s*return\s+"star"\s*;\s*\}\s*\}\s*class\s+OrbitLab\s*\{\s*public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*args\s*\)\s*\{\s*Body\s+body\s*=\s*new\s+(Planet|Star)\s*\(\s*\)\s*;\s*System\s*\.\s*out\s*\.\s*println\s*\(\s*body\s*\.\s*kind\s*\(\s*\)\s*\)\s*;\s*\}\s*\}\s*$/;
const rustResultPattern = /^fn\s+make_orbit\s*\(\s*radius\s*:\s*i32\s*\)\s*->\s*Result\s*<\s*i32\s*,\s*&\s*'static\s+str\s*>\s*\{\s*if\s+radius\s*(>=|>)\s*0\s*\{\s*Ok\s*\(\s*radius\s*\)\s*\}\s*else\s*\{\s*Err\s*\(\s*"invalid"\s*\)\s*\}\s*\}\s*fn\s+main\s*\(\s*\)\s*\{\s*let\s+radius\s*=\s*(-?\d+)\s*;\s*match\s+make_orbit\s*\(\s*radius\s*\)\s*\{\s*Ok\s*\(\s*value\s*\)\s*=>\s*println!\s*\(\s*"\{\}"\s*,\s*value\s*\)\s*,\s*Err\s*\(\s*message\s*\)\s*=>\s*println!\s*\(\s*"\{\}"\s*,\s*message\s*\)\s*,?\s*\}\s*\}\s*$/;

function readValues(raw: string): number[] | null {
  const parts = raw.split(',').map((item) => item.trim());
  if (parts.some((item) => item.length > 1 && item.startsWith('0'))) return null;
  const values = parts.map(Number);
  return values.length > 0 && values.length <= 8 && values.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) ? values : null;
}
function unsupported(id: LessonId, detail = '教材で指定された形に一致しません。編集できる範囲を確認してください。'): RunResult {
  return { status: 'unsupported', output: '', actual: '実行範囲外', explanation: detail, patch: getLesson(id).patch, trace: [], model: null, facts: {} };
}
function trace(label: string, state: string, index: number): TraceStep { return { index, label, state }; }
function model(radii: number[], highlightedIndex: number | null = null): ModelState { return { radii, highlightedIndex }; }

export function runLesson(id: LessonId, source: string): RunResult {
  const lesson = getLesson(id);
  if (source.length > MAX_CODE_LENGTH) return unsupported(id, `コードは${MAX_CODE_LENGTH}文字以下にしてください。`);
  // Whitespace normalization bounds regex work and does not alter any supported string literal.
  const code = source.replace(/\s+/g, ' ').trim();
  if (id === 'java-array') {
    const m = javaArrayPattern.exec(code);
    if (!m) return unsupported(id);
    const values = readValues(m[1]);
    if (!values) return unsupported(id, '配列には1〜9の整数を1〜8個入力してください。');
    const start = Number(m[2]); const op = m[3];
    const steps: TraceStep[] = [trace('初期化', `orbits.length = ${values.length} / count = 0`, 0)];
    let count = 0;
    const visited: number[] = [];
    for (let i = start; op === '<' ? i < values.length : i <= values.length; i++) {
      if (i >= values.length) {
        steps.push(trace('範囲外', `i = ${i}、有効な最後のindex = ${values.length - 1}`, steps.length));
        return { status: 'language-error', output: '', actual: '実行時エラー (ArrayIndexOutOfBoundsException)', explanation: `i = ${i} は配列の長さと同じ。orbits[${i}]は存在しないため、printlnの前に例外が起きます。`, patch: lesson.patch, trace: steps, model: null, facts: { values, op, start } };
      }
      visited.push(values[i]); count++;
      steps.push(trace(`i = ${i}`, `orbits[${i}] = ${values[i]} → count = ${count}`, steps.length));
    }
    steps.push(trace('出力', `count = ${count}`, steps.length));
    return { status: 'success', output: String(count), actual: String(count), explanation: `${count}個の要素を読みました。最後の有効なindexは${values.length - 1}です。`, patch: lesson.patch, trace: steps, model: model(visited), facts: { values, op, start } };
  }
  if (id === 'java-stream') {
    const m = javaStreamPattern.exec(code);
    if (!m) return unsupported(id);
    const values = readValues(m[1]); const op = m[2]; const threshold = Number(m[3]);
    if (!values || (m[3].length > 1 && m[3].startsWith('0')) || !Number.isInteger(threshold) || threshold > 10) return unsupported(id, '値は1〜9を1〜8個、しきい値は0〜10で入力してください。');
    const passes = (n: number): boolean => {
      if (op === '>=') return n >= threshold;
      if (op === '>') return n > threshold;
      if (op === '<=') return n <= threshold;
      if (op === '<') return n < threshold;
      return n === threshold;
    };
    const selected = values.filter(passes);
    const steps = values.map((n, i) => trace(`radius = ${n}`, `${n} ${op} ${threshold} → ${passes(n)}${passes(n) ? ' / 通過' : ' / 除外'}`, i));
    steps.push(trace('終端操作', `count() = ${selected.length}`, steps.length));
    return { status: 'success', output: String(selected.length), actual: String(selected.length), explanation: `${values.length}個のうち、条件を満たす${selected.length}個が通過しました。`, patch: lesson.patch, trace: steps, model: model(selected), facts: { values, op, threshold } };
  }
  if (id === 'java-polymorphism') {
    const m = javaPolyPattern.exec(code);
    if (!m) return unsupported(id);
    const type = m[1]; const output = type === 'Planet' ? 'planet' : 'star';
    return { status: 'success', output, actual: output, explanation: `宣言型はBodyですが、実体は${type}。${type}.kind()が呼ばれます。`, patch: lesson.patch, trace: [trace('宣言と生成', `Body body = new ${type}()`, 0), trace('動的ディスパッチ', `${type}.kind() を選択`, 1), trace('return / 出力', output, 2)], model: model(type === 'Planet' ? [3] : []), facts: { type } };
  }
  if (id === 'rust-ownership') {
    const m = rustOwnershipPattern.exec(code);
    if (!m) return unsupported(id);
    const values = readValues(m[1]);
    if (!values) return unsupported(id, 'Vecには1〜9の整数を1〜8個入力してください。');
    const mode = m[2].replace(/\s/g, '');
    if (mode === 'stars') {
      return { status: 'language-error', output: '', actual: 'コンパイルエラー (E0382)', explanation: 'Vecがviewへmoveされた後にstarsを使っています。Rustコンパイラは実行前にこれを拒否するため、println!はどちらも実行されません。', patch: lesson.patch, trace: [trace('所有権の検査', 'stars → view へmove', 0), trace('コンパイルエラー', 'move後のstarsを使用（E0382）', 1)], model: null, facts: { values, mode } };
    }
    const kind = mode === '&stars' ? '不変借用（コピーしない）' : 'clone（独立したVec）';
    const output = `${values.length}\n${values.length}`;
    return { status: 'success', output, actual: output, explanation: `${kind}なので、元のstarsも読めます。`, patch: lesson.patch, trace: [trace('生成', `stars: Vec / len = ${values.length}`, 0), trace('代入', `view = ${mode} / ${kind}`, 1), trace('出力', `${values.length}、${values.length}`, 2)], model: model(values), facts: { values, mode } };
  }
  if (id === 'rust-result') {
    const m = rustResultPattern.exec(code);
    if (!m) return unsupported(id);
    const op = m[1]; const radius = Number(m[2]);
    if (/^-?0\d/.test(m[2]) || !Number.isInteger(radius) || radius < -2 || radius > 9) return unsupported(id, '半径は-2〜9の整数を入力してください。');
    const ok = op === '>' ? radius > 0 : radius >= 0;
    const output = ok ? String(radius) : 'invalid';
    return { status: 'success', output, actual: output, explanation: ok ? `${radius} ${op} 0はtrue。Ok(${radius})から値を出力します。` : `${radius} ${op} 0はfalse。Err("invalid")をmatchし、文字列を出力します。panicではありません。`, patch: lesson.patch, trace: [trace('入力', `radius = ${radius}`, 0), trace('条件', `${radius} ${op} 0 → ${ok}`, 1), trace('match / 出力', ok ? `Ok(${radius}) → ${output}` : 'Err("invalid") → invalid', 2)], model: model(ok ? [radius] : []), facts: { op, radius } };
  }
  const m = rustOptionPattern.exec(code);
  if (!m) return unsupported(id);
  const values = readValues(m[1]); const index = Number(m[2]);
  if (!values || (m[2].length > 1 && m[2].startsWith('0')) || !Number.isInteger(index) || index > 9) return unsupported(id, '値は1〜9を1〜8個、indexは0〜9で入力してください。');
  const found = index < values.length;
  const output = found ? String(values[index]) : 'none';
  return { status: 'success', output, actual: output, explanation: found ? `index ${index} は範囲内。getはSome(&${values[index]})を返します。` : `index ${index} は範囲外。getはNoneを返し、Noneの腕が実行されます。`, patch: lesson.patch, trace: [trace('入力', `len = ${values.length} / index = ${index}`, 0), trace('get', found ? `Some(&${values[index]})` : 'None', 1), trace('match / 出力', output, 2)], model: model(values, found ? index : null), facts: { values, index } };
}

export function predictionMatches(prediction: string, result: RunResult): boolean {
  if (result.status === 'unsupported') return false;
  const p = prediction.trim().toLowerCase();
  if (result.status === 'language-error') return /^(エラー|例外|error|exception|e0382|コンパイルエラー|実行時エラー)$/.test(p);
  const normal = (s: string) => s.trim().toLowerCase().replace(/[、，/\n\s]+/g, ',').replace(/,+/g, ',');
  return normal(p) === normal(result.output);
}
export function isRebuildSatisfied(id: LessonId, result: RunResult): boolean {
  if (result.status !== 'success') return false;
  const f = result.facts;
  const same = (expected: number[]) => Array.isArray(f.values) && f.values.length === expected.length && f.values.every((v, i) => v === expected[i]);
  if (id === 'java-array') return same([1, 2, 3]) && f.op === '<' && f.start === 0 && result.output === '3';
  if (id === 'java-stream') return same([2, 4, 6, 8]) && f.op === '>=' && f.threshold === 4 && result.output === '3';
  if (id === 'java-polymorphism') return f.type === 'Planet' && result.output === 'planet';
  if (id === 'rust-result') return f.op === '>' && f.radius === 3 && result.output === '3';
  if (id === 'rust-ownership') return same([1, 2, 3]) && f.mode === '&stars' && result.output === '3\n3';
  return same([1, 2, 3]) && f.index === 1 && result.output === '2';
}
