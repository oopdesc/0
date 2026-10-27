/**
 * Java 値モデルと標準ライブラリ（教材で使う範囲）。
 *
 * 重要なのは「JDK と同じ表示・同じ比較・同じ例外」になること。
 * tools/verify-java.mjs が OpenJDK 21 で実際に実行した出力と、
 * この実装の出力をテストで突き合わせている。
 */

export type Prim = 'int' | 'long' | 'double' | 'float' | 'char' | 'boolean' | 'byte' | 'short';

export interface JPri {
  k: 'pri';
  t: Prim;
  v: number | bigint | string | boolean;
}
export interface JObj {
  k: 'obj';
  type: string;
  fields: Map<string, JValue>;
  native: NativePayload | null;
  id: number;
}
export interface JArr {
  k: 'arr';
  elemType: string;
  items: JValue[];
  id: number;
}
export interface JNull {
  k: 'null';
}
/** クラス名そのものを指す内部値（Math.PI のような静的参照の途中でだけ現れる） */
export interface JClassRef {
  k: 'class';
  name: string;
}
export type JValue = JPri | JObj | JArr | JNull | JClassRef;

export type NativePayload =
  | { kind: 'string'; s: string }
  | { kind: 'list'; items: JValue[]; modCount?: number }
  | { kind: 'set'; items: JValue[]; modCount?: number }
  | { kind: 'map'; entries: { key: JValue; value: JValue }[]; modCount?: number }
  | { kind: 'optional'; value: JValue | null }
  | { kind: 'stream'; items: JValue[]; ops: StreamOp[] }
  | { kind: 'builder'; s: string }
  | { kind: 'box'; value: JValue }
  | { kind: 'entry'; key: JValue; value: JValue }
  | { kind: 'fn'; params: string[]; body: unknown; env: unknown; kindOf: 'lambda' | 'methodref'; refOwner?: string }
  | { kind: 'class'; name: string }
  | { kind: 'throwable'; message: string | null; cause?: JValue; checked: boolean; stack: string[] }
  | { kind: 'iterator'; items: JValue[]; index: number; map?: JValue }
  | { kind: 'printstream'; err?: boolean };

export interface StreamOp {
  op: 'filter' | 'map' | 'sorted' | 'distinct' | 'limit' | 'skip' | 'mapToInt';
  fn?: JValue;
  n?: number;
}

export const jNull: JNull = { k: 'null' };
export const TRUE: JPri = { k: 'pri', t: 'boolean', v: true };
export const FALSE: JPri = { k: 'pri', t: 'boolean', v: false };

export function pri(t: Prim, v: number | bigint | string | boolean): JPri {
  switch (t) {
    case 'int':
    case 'byte':
    case 'short':
      return { k: 'pri', t, v: (v as number) | 0 };
    case 'long':
      return { k: 'pri', t, v: BigInt.asIntN(64, BigInt(v as bigint)) };
    case 'double':
      return { k: 'pri', t, v: (v as number) };
    case 'float':
      return { k: 'pri', t, v: Math.fround(v as number) };
    case 'char':
      return { k: 'pri', t, v: typeof v === 'string' ? v : String.fromCharCode(v as number) };
    case 'boolean':
      return { k: 'pri', t, v: Boolean(v) };
  }
}

export const I = (v: number): JPri => ({ k: 'pri', t: 'int', v: v | 0 });
export const D = (v: number): JPri => ({ k: 'pri', t: 'double', v });

let objectSeq = 0;
export function newObj(type: string, native: NativePayload | null = null): JObj {
  return { k: 'obj', type, fields: new Map(), native, id: ++objectSeq };
}
export function newArr(elemType: string, items: JValue[]): JArr {
  return { k: 'arr', elemType, items, id: ++objectSeq };
}
export function newString(s: string): JObj {
  return newObj('String', { kind: 'string', s });
}
/**
 * ボクシング。JDK と同じく Integer/Long の -128..127、Character の 0..127、
 * Boolean はキャッシュされた同一インスタンスを返す（== の結果が変わるため）。
 */
const BOX_CACHE = new Map<string, JObj>();
export function boxed(p: JPri): JObj {
  const map: Record<Prim, string> = {
    int: 'Integer', long: 'Long', double: 'Double', float: 'Float', char: 'Character', boolean: 'Boolean',
    byte: 'Byte', short: 'Short',
  };
  const t = map[p.t];
  let cacheable = false;
  if (t === 'Integer' || t === 'Long' || t === 'Byte' || t === 'Short') {
    const n = p.v as number;
    cacheable = Number.isInteger(n) && n >= -128 && n <= 127;
  } else if (t === 'Character') {
    cacheable = (p.v as number) >= 0 && (p.v as number) <= 127;
  } else if (t === 'Boolean') {
    cacheable = true;
  }
  if (!cacheable) return newObj(t, { kind: 'box', value: p });
  const key = t + ':' + String(p.v);
  const hit = BOX_CACHE.get(key);
  if (hit) return hit;
  const obj = newObj(t, { kind: 'box', value: p });
  BOX_CACHE.set(key, obj);
  return obj;
}

export function isPrim(v: JValue): v is JPri {
  return v.k === 'pri';
}
export function isIntLike(v: JValue): v is JPri {
  return v.k === 'pri' && (v.t === 'int' || v.t === 'byte' || v.t === 'short');
}

/* ── 例外 ─────────────────────────────────────────────── */

export class JavaThrow {
  constructor(
    public value: JObj,
    public line: number,
  ) {}
}

export class BreakSignal {
  constructor(public label: string | null) {}
}
export class ContinueSignal {
  constructor(public label: string | null) {}
}
export class ReturnSignal {
  constructor(public value: JValue) {}
}

const CHECKED = new Set(['Exception', 'IOException', 'InterruptedException', 'NumberFormatException_NO']);

export function makeException(type: string, message: string | null, line = 0): JavaThrow {
  const t = type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type;
  const obj = newObj(t, {
    kind: 'throwable',
    message,
    checked: CHECKED.has(t) && !t.startsWith('Runtime'),
    stack: [],
  });
  return new JavaThrow(obj, line);
}

export function throwableOf(v: JValue): { type: string; message: string | null; checked: boolean } {
  if (v.k === 'obj' && v.native?.kind === 'throwable') {
    return { type: v.type, message: v.native.message, checked: v.native.checked };
  }
  if (v.k === 'obj') return { type: v.type, message: null, checked: false };
  return { type: 'Object', message: null, checked: false };
}

/* ── 数値フォーマット（JDK と同じ見た目） ───────────────── */

export function javaDoubleToString(x: number): string {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const neg = x < 0;
  const a = Math.abs(x);
  let out: string;
  if (a >= 1e-3 && a < 1e7) {
    out = a.toString();
    if (!out.includes('.')) out += '.0';
  } else {
    out = toJavaScientific(a);
  }
  return neg ? '-' + out : out;
}

function toJavaScientific(a: number): string {
  let s = a.toExponential();
  // JS: "1e+20" / "1.234e-5"
  let [mant, expStr] = s.split('e');
  if (!expStr) return s;
  let exp = parseInt(expStr, 10);
  if (!mant.includes('.')) mant += '.0';
  // 1 桁の指数部に揃える（Java は桁数を固定しない）
  return `${mant}E${exp}`;
}

export function javaFloatToString(x: number): string {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  // float32 として最短で往復する十進表現を探す（Java の Float.toString と同じ方針）
  for (let p = 1; p <= 9; p++) {
    const s = x.toPrecision(p);
    if (Math.fround(parseFloat(s)) === Math.fround(x)) {
      const n = parseFloat(s);
      if (Math.abs(n) >= 1e-3 && Math.abs(n) < 1e7) {
        const t = s;
        return t.includes('.') ? t : t + '.0';
      }
      return toJavaScientific(Math.abs(parseFloat(s))).replace(/^/, n < 0 ? '-' : '');
    }
  }
  return javaDoubleToString(x);
}

/* ── 表示 ─────────────────────────────────────────────── */

export function display(v: JValue): string {
  return toStringJava(v);
}

export function toStringJava(v: JValue): string {
  switch (v.k) {
    case 'class':
      return 'class ' + v.name;
    case 'null':
      return 'null';
    case 'pri':
      if (v.t === 'double') return javaDoubleToString(v.v as number);
      if (v.t === 'float') return javaFloatToString(v.v as number);
      if (v.t === 'boolean') return v.v ? 'true' : 'false';
      if (v.t === 'char') return v.v as string;
      return String(v.v);
    case 'arr':
      return `${arrayDesc(v.elemType)}@${hashHex(v)}`;
    case 'obj': {
      const n = v.native;
      if (n) {
        switch (n.kind) {
          case 'string':
            return n.s;
          case 'list':
            return '[' + n.items.map((x) => toStringJava(x)).join(', ') + ']';
          case 'set':
            return '[' + n.items.map((x) => toStringJava(x)).join(', ') + ']';
          case 'map': {
            if (!n.entries.length) return '{}';
            return '{' + n.entries.map((e) => `${toStringJava(e.key)}=${toStringJava(e.value)}`).join(', ') + '}';
          }
          case 'builder':
            return n.s;
          case 'box':
            return toStringJava(n.value);
          case 'entry':
            return `${toStringJava(n.key)}=${toStringJava(n.value)}`;
          case 'optional':
            return n.value === null ? 'Optional.empty' : `Optional[${toStringJava(n.value)}]`;
          case 'throwable':
            return n.message === null ? v.type : `${v.type}: ${n.message}`;
          case 'stream':
            return 'java.util.stream.Stream';
          case 'fn':
            return `${v.type}@${hashHex(v)}`;
          default:
            break;
        }
      }
      if (v.type === 'String') return str(v).s;
      if (v.type === 'Class') return 'class ' + (v.native?.kind === 'class' ? v.native.name : 'Object');
      return `${v.type}@${hashHex(v)}`;
    }
  }
}

function arrayDesc(elemType: string): string {
  const map: Record<string, string> = {
    int: 'I', long: 'J', double: 'D', float: 'F', char: 'C', boolean: 'Z', byte: 'B', short: 'S',
  };
  return '[' + (map[elemType] ?? 'L' + elemType + ';');
}

let hashSeq = 0;
const hashes = new WeakMap<object, number>();
function hashHex(v: JValue): string {
  if (v.k === 'null') return '0';
  let h = hashes.get(v as object);
  if (h === undefined) {
    h = (v as JObj).id ?? ++hashSeq;
    hashes.set(v as object, h);
  }
  return (h * 2654435761 % 0xffffffff).toString(16);
}

export function str(o: JObj): { s: string } {
  if (o.native?.kind === 'string') return o.native;
  return { s: toStringJava(o) };
}

/* ── 比較・等価 ───────────────────────────────────────── */

export function toNumber(v: JValue): number {
  if (v.k === 'class') return NaN;
  if (v.k === 'pri') {
    if (v.t === 'char') return (v.v as string).charCodeAt(0);
    if (v.t === 'boolean') return v.v ? 1 : 0;
    return typeof v.v === 'bigint' ? Number(v.v) : (v.v as number);
  }
  if (v.k === 'obj' && v.native?.kind === 'box') return toNumber(v.native.value);
  if (v.k === 'obj' && v.native?.kind === 'string') return parseFloat(v.native.s);
  if (v.k === 'null') return 0;
  return NaN;
}

export function toLongBig(v: JValue): bigint {
  if (v.k === 'pri') {
    if (v.t === 'char') return BigInt((v.v as string).charCodeAt(0));
    if (typeof v.v === 'bigint') return v.v;
    return BigInt(Math.trunc(v.v as number));
  }
  if (v.k === 'obj' && v.native?.kind === 'box') return toLongBig(v.native.value);
  return 0n;
}

export function isNumeric(v: JValue): boolean {
  return v.k === 'pri' && ['int', 'long', 'double', 'float', 'char', 'byte', 'short'].includes(v.t);
}

export function truthy(v: JValue): boolean {
  if (v.k !== 'pri' || v.t !== 'boolean') throw new Error('boolean が必要です');
  return v.v as boolean;
}

/** == の意味（プリミティブは値、参照は同一性） */
export function refEquals(a: JValue, b: JValue): boolean {
  if (a.k === 'class' || b.k === 'class') return a === b;
  if (a.k === 'null' || b.k === 'null') return a.k === 'null' && b.k === 'null';
  if (a.k !== 'obj' || b.k !== 'obj') return a === b;
  return a.id === b.id;
}

/** Object.equals の意味（String・ボクシング・コレクションは内容で比較） */
export function equalsJava(a: JValue, b: JValue, customEquals?: (o: JObj, arg: JValue) => JValue | undefined): boolean {
  if (a.k === 'class' || b.k === 'class') return a === b;
  if (a.k === 'null' || b.k === 'null') return a.k === 'null' && b.k === 'null';
  if (a.k === 'pri' || b.k === 'pri') {
    if (a.k === 'pri' && b.k === 'pri') {
      if (a.t === 'char' && b.t === 'char') return a.v === b.v;
      if (a.t === 'boolean' || b.t === 'boolean') return a.v === b.v;
      return toNumber(a) === toNumber(b);
    }
    // 片方がボクシングなら、値で比較する（Integer.equals(3) は true）
    const box = a.k === 'obj' ? a.native : b.k === 'obj' ? b.native : null;
    const prim = a.k === 'pri' ? a : b;
    if (box?.kind === 'box') return equalsJava(box.value, prim, customEquals);
    return false;
  }
  if (a.k === 'arr' || b.k === 'arr') return a === b;
  const an = a.native;
  const bn = (b as JObj).native;
  if (an?.kind === 'string' && bn?.kind === 'string') return an.s === bn.s;
  if (an?.kind === 'box' && bn?.kind === 'box') return equalsJava(an.value, bn.value, customEquals);
  if (a.type === 'String' && (b as JObj).type === 'String') return str(a).s === str(b as JObj).s;
  if (an?.kind === 'list' && bn?.kind === 'list') {
    if (an.items.length !== bn.items.length) return false;
    return an.items.every((x, i) => equalsJava(x, bn.items[i], customEquals));
  }
  if (customEquals) {
    const res = customEquals(a, b);
    if (res !== undefined) return truthy(res);
  }
  return a.id === (b as JObj).id;
}

export function hashKey(v: JValue): string {
  if (v.k === 'class') return 'class:' + v.name;
  if (v.k === 'null') return 'null';
  if (v.k === 'pri') return `${v.t}:${String(v.v)}`;
  if (v.k === 'arr') return 'arr:' + v.id;
  const n = v.native;
  if (n?.kind === 'string') return 's:' + n.s;
  if (n?.kind === 'box') return 'box:' + hashKey(n.value);
  if (v.type === 'String') return 's:' + str(v).s;
  return 'o:' + v.id;
}

/* ── 数値演算（JDK の桁あふれと符号を再現） ─────────────── */

export function intAdd(a: number, b: number): number {
  return (a + b) | 0;
}
export function intMul(a: number, b: number): number {
  return Math.imul(a, b);
}
export function intDiv(a: number, b: number, line: number): number {
  if (b === 0) throw makeException('ArithmeticException', '/ by zero', line);
  if (a === -2147483648 && b === -1) return -2147483648;
  return (a / b) | 0;
}
export function intRem(a: number, b: number, line: number): number {
  if (b === 0) throw makeException('ArithmeticException', '/ by zero', line);
  return (a % b) | 0;
}
export function longAdd(a: bigint, b: bigint): bigint {
  return BigInt.asIntN(64, a + b);
}
export function longMul(a: bigint, b: bigint): bigint {
  return BigInt.asIntN(64, a * b);
}
export function longDiv(a: bigint, b: bigint, line: number): bigint {
  if (b === 0n) throw makeException('ArithmeticException', '/ by zero', line);
  return a / b;
}
export function longRem(a: bigint, b: bigint, line: number): bigint {
  if (b === 0n) throw makeException('ArithmeticException', '/ by zero', line);
  return a % b;
}

export function doubleDiv(a: number, b: number): number {
  return a / b;
}
