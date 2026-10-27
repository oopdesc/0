/**
 * 標準ライブラリの実装。JDK の仕様に合わせ、戻り値・副作用・例外を揃える。
 * ここで扱わない API は「未対応」として明示的にエラーにする（黙って別動作にしない）。
 */
import {
  D, I, JPri, JValue, JObj, NativePayload, boxed, display, equalsJava, hashKey, javaDoubleToString,
  newArr, newObj, newString, pri, toStringJava, jNull, makeException,
} from './runtime';

export const NOT_NATIVE = Symbol('not-native');

export interface Helpers {
  callFn(fn: JValue, args: JValue[]): JValue;
  callFnWithThis?(fn: JValue, self: JValue, args: JValue[]): JValue;
  userEquals?(o: JObj, arg: JValue): JValue | undefined;
  userCompare?(o: JObj, arg: JValue): number | undefined;
  unsupported(what: string): never;
}

export function isStringVal(v: JValue): boolean {
  return v.k === 'obj' && (v as JObj).type === 'String';
}

export function stringOf(v: JValue): string {
  if (v.k === 'obj' && v.native?.kind === 'string') return v.native.s;
  return toStringJava(v);
}

export function makeString(s: string): JObj {
  return newString(s);
}

export function makeList(items: JValue[] = []): JObj {
  return newObj('ArrayList', { kind: 'list', items });
}
export function makeSet(items: JValue[] = []): JObj {
  return newObj('HashSet', { kind: 'set', items });
}
export function makeMap(entries: { key: JValue; value: JValue }[] = []): JObj {
  return newObj('HashMap', { kind: 'map', entries });
}
export function makeOptional(value: JValue | null): JObj {
  return newObj('Optional', { kind: 'optional', value });
}

function itemsOf(v: JValue): JValue[] | null {
  if (v.k === 'arr') return v.items;
  if (v.k === 'obj') {
    const n = v.native;
    if (n?.kind === 'list') return n.items;
    if (n?.kind === 'set') return n.items;
  }
  return null;
}

function isIntegral(v: JValue): boolean {
  return v.k === 'pri' && ['int', 'byte', 'short', 'char', 'long'].includes(v.t);
}
function numOf(v: JValue): number {
  if (v.k !== 'pri') throw makeException('NullPointerException', 'unboxing of null');
  if (v.t === 'char') return (v.v as string).charCodeAt(0);
  if (typeof v.v === 'bigint') return Number(v.v);
  return v.v as number;
}

function naturalCompare(a: JValue, b: JValue, h: Helpers): number {
  if (a.k === 'pri' && b.k === 'pri') return numOf(a) - numOf(b);
  if (isStringVal(a) && isStringVal(b)) return stringOf(a) < stringOf(b) ? -1 : stringOf(a) > stringOf(b) ? 1 : 0;
  if (a.k === 'obj' && h.userCompare) {
    const c = h.userCompare(a, b);
    if (c !== undefined) return c;
  }
  return 0;
}

/* ── Stream / Optional / Builder の生成元 ─────────────── */

function evalStream(items: JValue[], ops: { op: string; fn?: JValue; n?: number }[]): JValue[] {
  let data = items;
  for (const op of ops as any[]) {
    switch (op.op) {
      case 'filter':
        data = data.filter((x) => {
          const r = op.fn ? callBool(op.fn, x) : false;
          return r;
        });
        break;
      case 'map':
        data = data.map((x) => (op.fn ? call1(op.fn, x) : jNull));
        break;
      case 'sorted':
        data = [...data].sort((a, b) => (op.fn ? compareWith(op.fn, a, b) : naturalCompare(a, b, CURRENT_HELPERS!)));
        break;
      case 'distinct': {
        const seen = new Set<string>();
        data = data.filter((x) => {
          const k = hashKey(x);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        break;
      }
      case 'limit':
        data = data.slice(0, op.n ?? 0);
        break;
      case 'skip':
        data = data.slice(op.n ?? 0);
        break;
      case 'mapToInt':
        data = data.map((x) => (op.fn ? call1(op.fn, x) : I(0)));
        break;
    }
  }
  return data;
}

function call1(fn: JValue, x: JValue): JValue {
  return CURRENT_HELPERS!.callFn(fn, [x]);
}
function callBool(fn: JValue, x: JValue): boolean {
  const r = call1(fn, x);
  return r.k === 'pri' && r.t === 'boolean' ? (r.v as boolean) : false;
}
function compareWith(fn: JValue, a: JValue, b: JValue): number {
  const r = CURRENT_HELPERS!.callFn(fn, [a, b]);
  return numOf(r);
}
let CURRENT_HELPERS: Helpers | null = null;

/* ── 出力 ─────────────────────────────────────────────── */

export interface PrintSink {
  print(s: string): void;
  println(s: string): void;
  flush(): void;
}

export function formatJava(fmt: string, args: JValue[], h: Helpers): string {
  let out = '';
  let ai = 0;
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (c !== '%') {
      out += c;
      continue;
    }
    i++;
    let spec = '';
    while (i < fmt.length && /[0-9.+\-# ,$]/.test(fmt[i])) spec += fmt[i++];
    const conv = fmt[i];
    const width = Number(spec.match(/\d+/)?.[0] ?? 0);
    const precision = spec.includes('.') ? Number(spec.split('.')[1]) : null;
    const arg = args[ai++];
    let piece = '';
    switch (conv) {
      case 'd':
        piece = String(Math.trunc(numOf(arg)));
        break;
      case 'f': {
        const v = numOf(arg);
        piece = precision === null ? javaDoubleToString(v) : v.toFixed(precision);
        break;
      }
      case 's':
        piece = arg === undefined || arg.k === 'null' ? 'null' : display(arg);
        break;
      case 'b':
        piece = arg && arg.k === 'pri' && arg.t === 'boolean' ? String(arg.v) : arg && arg.k === 'null' ? 'false' : 'true';
        break;
      case 'c':
        piece = String.fromCharCode(numOf(arg));
        break;
      case 'x':
        piece = Math.trunc(numOf(arg)).toString(16);
        break;
      case 'X':
        piece = Math.trunc(numOf(arg)).toString(16).toUpperCase();
        break;
      case '%':
        piece = '%';
        break;
      case 'n':
        piece = '\n';
        break;
      default:
        h.unsupported(`String.format の %${conv}`);
    }
    // %d の 3 桁区切り（%,d）。ロケールに依存しない形で実装する。
    if (conv === 'd' && spec.includes(',')) piece = piece.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (width > piece.length) {
      const pad = width - piece.length;
      if (spec.includes('-')) piece = piece + ' '.repeat(pad);
      else if (spec.includes('0') && /[dfxX]/.test(conv)) {
        const neg = piece.startsWith('-');
        piece = (neg ? '-' : '') + '0'.repeat(pad) + (neg ? piece.slice(1) : piece);
      } else piece = ' '.repeat(pad) + piece;
    }
    out += piece;
  }
  return out;
}

/* ── 本体 ─────────────────────────────────────────────── */

export function callStatic(owner: string, name: string, args: JValue[], h: Helpers): JValue | typeof NOT_NATIVE {
  CURRENT_HELPERS = h;
  const key = `${owner}.${name}`;
  switch (key) {
    /* String */
    case 'String.valueOf':
      return newString(args.length && args[0].k === 'arr' ? displayArrayArg(args[0]) : args.length ? display(args[0]) : 'null');
    case 'String.format':
      return newString(formatJava(stringOf(args[0]), args.slice(1), h));
    case 'String.join': {
      const sep = stringOf(args[0]);
      const rest = args.length === 2 && itemsOf(args[1]) ? itemsOf(args[1])! : args.slice(1);
      return newString(rest.map((x) => display(x)).join(sep));
    }

    /* Integer / Double / Long */
    case 'Integer.parseInt':
    case 'Long.parseLong':
    case 'Double.parseDouble':
    case 'Float.parseFloat': {
      const s = stringOf(args[0]).trim();
      const numeric = key.startsWith('Integer') || key.startsWith('Long') ? /^[+-]?\d+$/ : /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
      if (!numeric.test(s)) {
        throw makeException(
          'NumberFormatException',
          `For input string: "${stringOf(args[0])}"`,
        );
      }
      if (key === 'Integer.parseInt') return I(parseInt(s, 10) | 0);
      if (key === 'Long.parseLong') return pri('long', BigInt(s));
      if (key === 'Float.parseFloat') return pri('float', parseFloat(s));
      return D(parseFloat(s));
    }
    case 'Integer.valueOf':
      if (args.length === 1 && isStringVal(args[0])) {
        const s = stringOf(args[0]).trim();
        if (!/^[+-]?\d+$/.test(s)) throw makeException('NumberFormatException', `For input string: "${s}"`);
        return integerBox(parseInt(s, 10) | 0);
      }
      return integerBox(numOf(args[0]) | 0);
    case 'Integer.toString':
      return newString(String(numOf(args[0]) | 0));
    case 'Integer.toBinaryString':
      return newString((numOf(args[0]) >>> 0).toString(2));
    case 'Integer.compare':
      return I(Math.sign(numOf(args[0]) - numOf(args[1])));
    case 'Integer.MAX_VALUE' as string:
      return I(2147483647);
    case 'Integer.sum':
      return I((numOf(args[0]) + numOf(args[1])) | 0);
    case 'Integer.min':
      return I(Math.min(numOf(args[0]), numOf(args[1])));
    case 'Integer.max':
      return I(Math.max(numOf(args[0]), numOf(args[1])));
    case 'Double.valueOf':
      return newObj('Double', { kind: 'box', value: D(numOf(args[0])) });
    case 'Double.toString':
      return newString(javaDoubleToString(numOf(args[0])));
    case 'Boolean.parseBoolean':
      return args[0].k === 'obj' && stringOf(args[0]).toLowerCase() === 'true' ? { k: 'pri', t: 'boolean', v: true } : { k: 'pri', t: 'boolean', v: false };
    case 'Boolean.valueOf':
      return newObj('Boolean', { kind: 'box', value: { k: 'pri', t: 'boolean', v: isStringVal(args[0]) ? stringOf(args[0]).toLowerCase() === 'true' : numOf(args[0]) !== 0 } });

    /* Character */
    case 'Character.isDigit':
      return bool(/^[0-9]$/.test(String.fromCharCode(numOf(args[0]))));
    case 'Character.isLetter':
      return bool(/^\p{L}$/u.test(String.fromCharCode(numOf(args[0]))));
    case 'Character.isUpperCase':
      return bool(/^\p{Lu}$/u.test(String.fromCharCode(numOf(args[0]))));
    case 'Character.isLowerCase':
      return bool(/^\p{Ll}$/u.test(String.fromCharCode(numOf(args[0]))));
    case 'Character.toUpperCase':
      return pri('char', String.fromCharCode(numOf(args[0])).toUpperCase().charCodeAt(0));
    case 'Character.toLowerCase':
      return pri('char', String.fromCharCode(numOf(args[0])).toLowerCase().charCodeAt(0));

    /* Math */
    case 'Math.abs': {
      if (args[0].k === 'pri' && args[0].t === 'long') return pri('long', BigInt.asIntN(64, (args[0].v as bigint) < 0n ? -(args[0].v as bigint) : (args[0].v as bigint)));
      if (args[0].k === 'pri' && (args[0].t === 'double' || args[0].t === 'float')) return pri(args[0].t, Math.abs(numOf(args[0])));
      return I(Math.abs(numOf(args[0]) | 0));
    }
    case 'Math.max':
    case 'Math.min': {
      const a = args[0], b = args[1];
      const useDouble = (a.k === 'pri' && (a.t === 'double' || a.t === 'float')) || (b.k === 'pri' && (b.t === 'double' || b.t === 'float'));
      const useLong = (a.k === 'pri' && a.t === 'long') || (b.k === 'pri' && b.t === 'long');
      const f = name === 'max' ? Math.max : Math.min;
      if (useDouble) return D(f(numOf(a), numOf(b)));
      if (useLong) {
        const av = BigInt(Math.trunc(numOf(a)));
        const bv = BigInt(Math.trunc(numOf(b)));
        return pri('long', name === 'max' ? (av > bv ? av : bv) : av < bv ? av : bv);
      }
      return I(f(numOf(a) | 0, numOf(b) | 0));
    }
    case 'Math.pow':
      return D(Math.pow(numOf(args[0]), numOf(args[1])));
    case 'Math.sqrt':
      return D(Math.sqrt(numOf(args[0])));
    case 'Math.round':
      // Java の Math.round(double) は floor(x + 0.5)。
      // 負の値では floor 側（-1.5 → -1）になる点も Java と同じ。
      return I(Math.floor(numOf(args[0]) + 0.5) | 0);
    case 'Math.floor':
      return D(Math.floor(numOf(args[0])));
    case 'Math.ceil':
      return D(Math.ceil(numOf(args[0])));
    case 'Math.hypot':
      return D(Math.hypot(numOf(args[0]), numOf(args[1])));

    /* Arrays */
    case 'Arrays.asList': {
      const src = args.length === 1 && args[0].k === 'arr' ? args[0].items : args;
      return newObj('Arrays$ArrayList', { kind: 'list', items: [...src] });
    }
    case 'Arrays.toString': {
      const arr = args[0];
      if (arr.k === 'arr') return newString('[' + arr.items.map((x) => display(x)).join(', ') + ']');
      return newString('[' + (itemsOf(arr) ?? []).map((x) => display(x)).join(', ') + ']');
    }
    case 'Arrays.sort': {
      const arr = args[0];
      if (arr.k === 'arr') arr.items.sort((a, b) => naturalCompare(a, b, h));
      else if (arr.k === 'obj' && arr.native?.kind === 'list') arr.native.items.sort((a, b) => naturalCompare(a, b, h));
      return jNull;
    }
    case 'Arrays.copyOf': {
      const arr = args[0];
      const n = numOf(args[1]);
      if (arr.k === 'arr') {
        const out = arr.items.slice(0, n);
        while (out.length < n) out.push(defaultFor(arr.elemType));
        return newArr(arr.elemType, out);
      }
      return jNull;
    }
    case 'Arrays.equals': {
      const a = args[0], b = args[1];
      if (a.k === 'arr' && b.k === 'arr') {
        return bool(a.items.length === b.items.length && a.items.every((x, i) => equalsJava(x, b.items[i])));
      }
      return bool(false);
    }
    case 'Arrays.fill': {
      const arr = args[0];
      if (arr.k === 'arr') arr.items = arr.items.map(() => args[1]);
      return jNull;
    }
    case 'Arrays.stream': {
      const arr = args[0];
      if (arr.k === 'arr') return newObj('Stream', { kind: 'stream', items: [...arr.items], ops: [] });
      return newObj('Stream', { kind: 'stream', items: [...(itemsOf(arr) ?? [])], ops: [] });
    }

    /* Collections */
    case 'Collections.sort': {
      const l = args[0];
      if (l.k === 'obj' && l.native?.kind === 'list') l.native.items.sort((a, b) => naturalCompare(a, b, h));
      return jNull;
    }
    case 'Collections.reverse': {
      const l = args[0];
      if (l.k === 'obj' && l.native?.kind === 'list') l.native.items.reverse();
      return jNull;
    }
    case 'Collections.emptyList':
      return makeList([]);
    case 'List.of':
    case 'Set.of':
      return newObj('ImmutableList', { kind: 'list', items: [...args] });
    case 'Map.of': {
      const entries: { key: JValue; value: JValue }[] = [];
      for (let i = 0; i + 1 < args.length; i += 2) entries.push({ key: args[i], value: args[i + 1] });
      return newObj('ImmutableMap', { kind: 'map', entries });
    }

    /* Objects */
    case 'Objects.equals':
      return bool(equalsJava(args[0], args[1]));
    case 'Objects.requireNonNull':
      if (args[0].k === 'null') throw makeException('NullPointerException', args.length > 1 ? stringOf(args[1]) : 'required non-null');
      return args[0];
    case 'Objects.toString':
      return newString(args[0].k === 'null' ? (args[1] ? stringOf(args[1]) : 'null') : display(args[0]));

    /* Collectors */
    case 'Collectors.toList':
      return newObj('Collector', { kind: 'box', value: newString('toList') });
    case 'Collectors.toSet':
      return newObj('Collector', { kind: 'box', value: newString('toSet') });
    case 'Collectors.joining':
      return newObj('Collector', { kind: 'box', value: newString('joining:' + (args[0] ? stringOf(args[0]) : '')) });
    case 'Collectors.counting':
      return newObj('Collector', { kind: 'box', value: newString('counting') });

    /* Optional */
    case 'Optional.of':
      if (args[0].k === 'null') throw makeException('NullPointerException', 'Optional.of に null は渡せません');
      return makeOptional(args[0]);
    case 'Optional.ofNullable':
      return makeOptional(args[0].k === 'null' ? null : args[0]);
    case 'Optional.empty':
      return makeOptional(null);

    /* Comparator */
    case 'Comparator.comparing': {
      const keyFn = args[0];
      return newObj('Comparator', { kind: 'fn', params: ['a', 'b'], body: { kind: 'comparing', keyFn }, env: null, kindOf: 'lambda' });
    }
    case 'Comparator.naturalOrder':
      return newObj('Comparator', { kind: 'fn', params: ['a', 'b'], body: { kind: 'natural' }, env: null, kindOf: 'lambda' });

    /* System */
    case 'System.currentTimeMillis':
      return pri('long', BigInt(Date.now()));

    default:
      break;
  }

  // 定数フィールド（Integer.MAX_VALUE など）
  const consts: Record<string, JValue> = {
    'Integer.MAX_VALUE': I(2147483647),
    'Integer.MIN_VALUE': I(-2147483648),
    'Long.MAX_VALUE': pri('long', 9223372036854775807n),
    'Long.MIN_VALUE': pri('long', -9223372036854775808n),
    'Double.MAX_VALUE': D(Number.MAX_VALUE),
    'Double.MIN_VALUE': D(Number.MIN_VALUE),
    'Math.PI': D(Math.PI),
    'Math.E': D(Math.E),
    'Boolean.TRUE': { k: 'pri', t: 'boolean', v: true },
    'Boolean.FALSE': { k: 'pri', t: 'boolean', v: false },
  };
  if (consts[key]) return consts[key];
  return NOT_NATIVE;
}

function displayArrayArg(v: JValue): string {
  if (v.k === 'arr') return '[' + v.items.map((x) => display(x)).join(', ') + ']';
  return display(v);
}

function defaultFor(type: string): JValue {
  switch (type) {
    case 'int':
    case 'byte':
    case 'short':
      return I(0);
    case 'long':
      return pri('long', 0n);
    case 'double':
      return D(0);
    case 'float':
      return pri('float', 0);
    case 'char':
      return pri('char', '\0');
    case 'boolean':
      return bool(false);
    default:
      return jNull;
  }
}

function integerBox(n: number): JObj {
  // Integer.valueOf のキャッシュ（-128..127）を実際に再現する
  return boxed(I(n));
}

function bool(b: boolean): JPri {
  return { k: 'pri', t: 'boolean', v: b };
}

/* ── インスタンスメソッド ─────────────────────────────── */

export function callMethod(recv: JValue, name: string, args: JValue[], h: Helpers): JValue | typeof NOT_NATIVE {
  CURRENT_HELPERS = h;

  if (recv.k === 'null') {
    throw makeException('NullPointerException', `Cannot invoke "${name}()" because the value is null`);
  }

  /* 配列 */
  if (recv.k === 'arr') {
    switch (name) {
      case 'length':
        return I(recv.items.length);
      case 'clone':
        return newArr(recv.elemType, [...recv.items]);
      case 'toString':
        return newString('[array');
      default:
        return NOT_NATIVE;
    }
  }

  if (recv.k !== 'obj') return NOT_NATIVE;
  const obj = recv;
  const nat = obj.native;

  /* ラムダ・メソッド参照 */
  if (nat?.kind === 'fn') {
    if (name === 'apply' || name === 'test' || name === 'accept' || name === 'get' || name === 'compare' || name === 'compose') {
      return h.callFn(recv, args);
    }
    if (name === 'andThen') {
      const first = obj;
      const second = args[0];
      return newObj('Function', {
        kind: 'fn', params: ['x'], body: { kind: 'chain', first, second }, env: null, kindOf: 'lambda',
      });
    }
    if (name === 'toString') return newString(display(recv));
    return NOT_NATIVE;
  }

  /* String */
  if (obj.type === 'String' && nat?.kind === 'string') {
    const s = nat.s;
    switch (name) {
      case 'length': return I(s.length);
      case 'isEmpty': return bool(s.length === 0);
      case 'isBlank': return bool(s.trim().length === 0);
      case 'charAt': {
        const i = numOf(args[0]);
        if (i < 0 || i >= s.length) throw makeException('StringIndexOutOfBoundsException', `index ${i}, length ${s.length}`);
        return pri('char', s[i]);
      }
      case 'substring': {
        const a = numOf(args[0]);
        const b = args.length > 1 ? numOf(args[1]) : s.length;
        if (a < 0 || b > s.length || a > b) throw makeException('StringIndexOutOfBoundsException', `begin ${a}, end ${b}, length ${s.length}`);
        return newString(s.slice(a, b));
      }
      case 'indexOf':
        return I(args.length > 1 ? s.indexOf(stringOf(args[0]), numOf(args[1])) : s.indexOf(stringOf(args[0])));
      case 'lastIndexOf':
        return I(s.lastIndexOf(stringOf(args[0])));
      case 'equals':
        return bool(isStringVal(args[0]) && stringOf(args[0]) === s);
      case 'equalsIgnoreCase':
        return bool(isStringVal(args[0]) && stringOf(args[0]).toLowerCase() === s.toLowerCase());
      case 'contains':
        return bool(s.includes(stringOf(args[0])));
      case 'startsWith':
        return bool(s.startsWith(stringOf(args[0])));
      case 'endsWith':
        return bool(s.endsWith(stringOf(args[0])));
      case 'toUpperCase':
        return newString(s.toUpperCase());
      case 'toLowerCase':
        return newString(s.toLowerCase());
      case 'trim':
        return newString(s.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, ''));
      case 'strip':
        return newString(s.trim());
      case 'replace': {
        const a = args[0], b = args[1];
        if (a.k === 'pri' && a.t === 'char' && b.k === 'pri' && b.t === 'char') {
          return newString(s.split(String(a.v)).join(String(b.v)));
        }
        return newString(s.split(stringOf(a)).join(stringOf(b)));
      }
      case 'replaceAll':
        return newString(s.replace(new RegExp(stringOf(args[0]), 'g'), stringOf(args[1])));
      case 'split': {
        const re = new RegExp(stringOf(args[0]));
        let parts = s.split(re);
        if (args.length > 1) {
          const lim = numOf(args[1]);
          if (lim > 0) {
            const head = s.split(re, lim);
            parts = head;
          }
        }
        // Java は末尾の空文字を落とす（limit 0 のとき）
        if (args.length <= 1 || numOf(args[1]) === 0) {
          while (parts.length && parts[parts.length - 1] === '') parts.pop();
        }
        return newArr('String', parts.map((p) => newString(p)));
      }
      case 'repeat':
        return newString(s.repeat(Math.max(0, numOf(args[0]))));
      case 'concat':
        return newString(s + stringOf(args[0]));
      case 'compareTo':
        return I(s < stringOf(args[0]) ? -1 : s > stringOf(args[0]) ? 1 : 0);
      case 'matches':
        return bool(new RegExp('^(?:' + stringOf(args[0]) + ')$').test(s));
      case 'toCharArray':
        return newArr('char', [...s].map((c) => pri('char', c)));
      case 'chars':
        return newObj('IntStream', { kind: 'stream', items: [...s].map((c) => I(c.charCodeAt(0))), ops: [] });
      case 'toString':
        return newString(s);
      case 'hashCode':
        return I(0);
      default:
        return NOT_NATIVE;
    }
  }

  /* StringBuilder */
  if (nat?.kind === 'builder') {
    switch (name) {
      case 'append':
        nat.s += args[0].k === 'null' ? 'null' : display(args[0]);
        return recv;
      case 'toString':
        return newString(nat.s);
      case 'length':
        return I(nat.s.length);
      case 'reverse':
        nat.s = [...nat.s].reverse().join('');
        return recv;
      default:
        return NOT_NATIVE;
    }
  }

  /* ボクシング */
  if (nat?.kind === 'box') {
    switch (name) {
      case 'intValue': return I(numOf(nat.value) | 0);
      case 'doubleValue': return D(numOf(nat.value));
      case 'longValue': return pri('long', BigInt(Math.trunc(numOf(nat.value))));
      case 'booleanValue': return bool(numOf(nat.value) !== 0);
      case 'equals': {
        if (args[0].k === 'pri') return bool(equalsJava(nat.value, args[0]));
        return bool(args[0].k === 'obj' && args[0].native?.kind === 'box' && equalsJava(nat.value, args[0].native.value));
      }
      case 'toString': return newString(display(nat.value));
      case 'hashCode': return I(numOf(nat.value) | 0);
      case 'compareTo': return I(Math.sign(numOf(nat.value) - numOf(args[0])));
      default: return NOT_NATIVE;
    }
  }

  /* List / Set */
  if (nat?.kind === 'list' || nat?.kind === 'set') {
    const items = nat.items;
    const isSet = nat.kind === 'set';
    // 構造変更（要素の追加・削除）を数える。for-each 中の同時変更検査に使う。
    const bump = () => {
      nat.modCount = (nat.modCount ?? 0) + 1;
    };
    switch (name) {
      case 'size': return I(items.length);
      case 'isEmpty': return bool(items.length === 0);
      case 'add':
        if (recv.type === 'ImmutableList' || recv.type === 'Arrays$ArrayList' || recv.type === 'ImmutableSet' || recv.type === 'ImmutableMap') {
          throw makeException('UnsupportedOperationException', 'immutable なコレクションは変更できません');
        }
        if (isSet) {
          const key = hashKey(args[0]);
          if (items.some((x) => hashKey(x) === key)) return bool(false);
        }
        items.push(args[0]);
        bump();
        return isSet ? bool(true) : bool(true);
      case 'addAll':
        for (const x of itemsOf(args[0]) ?? []) items.push(x);
        bump();
        return bool(true);
      case 'get': {
        if (isSet) return NOT_NATIVE;
        const i = numOf(args[0]);
        if (i < 0 || i >= items.length) throw makeException('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${items.length}`);
        return items[i];
      }
      case 'set': {
        const i = numOf(args[0]);
        if (i < 0 || i >= items.length) throw makeException('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${items.length}`);
        const old = items[i];
        items[i] = args[1];
        return old;
      }
      case 'remove': {
        if (args[0].k === 'pri' && isIntegral(args[0]) && !isSet) {
          const i = numOf(args[0]);
          if (i < 0 || i >= items.length) throw makeException('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${items.length}`);
          const [removed] = items.splice(i, 1);
          bump();
          return removed;
        }
        const key = hashKey(args[0]);
        const idx = items.findIndex((x) => hashKey(x) === key || equalsJava(x, args[0], h.userEquals));
        if (idx >= 0) {
          items.splice(idx, 1);
          bump();
          return bool(true);
        }
        return bool(false);
      }
      case 'contains':
        return bool(items.some((x) => equalsJava(x, args[0], h.userEquals)));
      case 'indexOf':
        return I(items.findIndex((x) => equalsJava(x, args[0], h.userEquals)));
      case 'clear':
        items.length = 0;
        bump();
        return jNull;
      case 'forEach':
        for (const x of [...items]) h.callFn(args[0], [x]);
        return jNull;
      case 'stream':
        return newObj('Stream', { kind: 'stream', items: [...items], ops: [] });
      case 'sort': {
        if (args[0]) items.sort((a, b) => compareWith(args[0], a, b));
        else items.sort((a, b) => naturalCompare(a, b, h));
        return jNull;
      }
      case 'toString': return newString(display(recv));
      case 'iterator':
        return newObj('Iterator', { kind: 'iterator', items: [...items], index: 0 });
      default:
        return NOT_NATIVE;
    }
  }

  /* Map */
  if (nat?.kind === 'map') {
    const entries = nat.entries;
    const find = (k: JValue) => entries.findIndex((e) => equalsJava(e.key, k, h.userEquals));
    switch (name) {
      case 'put': {
        const i = find(args[0]);
        if (i >= 0) {
          const old = entries[i].value;
          entries[i].value = args[1];
          return old;
        }
        entries.push({ key: args[0], value: args[1] });
        return jNull;
      }
      case 'get': {
        const i = find(args[0]);
        return i >= 0 ? entries[i].value : jNull;
      }
      case 'getOrDefault': {
        const i = find(args[0]);
        return i >= 0 ? entries[i].value : args[1];
      }
      case 'containsKey':
        return bool(find(args[0]) >= 0);
      case 'containsValue':
        return bool(entries.some((e) => equalsJava(e.value, args[0], h.userEquals)));
      case 'remove': {
        const i = find(args[0]);
        if (i < 0) return jNull;
        const [e] = entries.splice(i, 1);
        return e.value;
      }
      case 'size': return I(entries.length);
      case 'isEmpty': return bool(entries.length === 0);
      case 'keySet':
        return newObj('HashSet', { kind: 'set', items: entries.map((e) => e.key) });
      case 'values':
        return newObj('ArrayList', { kind: 'list', items: entries.map((e) => e.value) });
      case 'entrySet':
        return newObj('ArrayList', {
          kind: 'list',
          items: entries.map((e) => newObj('Entry', { kind: 'entry', key: e.key, value: e.value })),
        });
      case 'forEach':
        for (const e of [...entries]) h.callFn(args[0], [e.key, e.value]);
        return jNull;
      case 'merge': {
        const i = find(args[0]);
        if (i < 0) {
          entries.push({ key: args[0], value: args[1] });
          return args[1];
        }
        const merged = h.callFn(args[2], [entries[i].value, args[1]]);
        entries[i].value = merged;
        return merged;
      }
      case 'computeIfAbsent': {
        const i = find(args[0]);
        if (i >= 0 && entries[i].value.k !== 'null') return entries[i].value;
        const v = h.callFn(args[1], [args[0]]);
        if (i >= 0) entries[i].value = v;
        else entries.push({ key: args[0], value: v });
        return v;
      }
      case 'toString': return newString(display(recv));
      default:
        return NOT_NATIVE;
    }
  }

  /* Map.Entry */
  if (nat?.kind === 'entry') {
    switch (name) {
      case 'getKey': return nat.key;
      case 'getValue': return nat.value;
      case 'toString': return newString(`${display(nat.key)}=${display(nat.value)}`);
      default:
        return NOT_NATIVE;
    }
  }

  /* Optional */
  if (nat?.kind === 'optional') {
    const value = nat.value;
    switch (name) {
      case 'isPresent': return bool(value !== null);
      case 'isEmpty': return bool(value === null);
      case 'get':
      case 'getAsInt':
        if (value === null) throw makeException('NoSuchElementException', 'No value present');
        return value;
      case 'orElse': return value ?? args[0];
      case 'orElseGet': return value ?? h.callFn(args[0], []);
      case 'orElseThrow':
        if (value === null) throw makeException('NoSuchElementException', 'No value present');
        return value;
      case 'ifPresent':
        if (value !== null) h.callFn(args[0], [value]);
        return jNull;
      case 'map': return makeOptional(value === null ? null : h.callFn(args[0], [value]));
      case 'filter': {
        if (value === null) return makeOptional(null);
        const ok = h.callFn(args[0], [value]);
        return makeOptional(ok.k === 'pri' && ok.t === 'boolean' && ok.v ? value : null);
      }
      case 'toString': return newString(display(recv));
      default: return NOT_NATIVE;
    }
  }

  /* Stream */
  if (nat?.kind === 'stream') {
    const push = (op: NativePayload extends never ? never : any) => {
      const next = newObj('Stream', { kind: 'stream', items: nat.items, ops: [...nat.ops, op] });
      return next;
    };
    switch (name) {
      case 'filter': return push({ op: 'filter', fn: args[0] });
      case 'map': return push({ op: 'map', fn: args[0] });
      case 'mapToInt': return push({ op: 'mapToInt', fn: args[0] });
      case 'sorted':
        return push({ op: 'sorted', fn: args[0] });
      case 'distinct': return push({ op: 'distinct' });
      case 'limit': return push({ op: 'limit', n: numOf(args[0]) });
      case 'skip': return push({ op: 'skip', n: numOf(args[0]) });
      case 'collect': {
        const data = evalStream(nat.items, nat.ops as any);
        const collector = args[0];
        const kindStr = collector.k === 'obj' && collector.native?.kind === 'box' && isStringVal(collector.native.value)
          ? stringOf(collector.native.value)
          : 'toList';
        if (kindStr.startsWith('joining')) {
          const sep = kindStr.split(':')[1] ?? '';
          return newString(data.map((x) => display(x)).join(sep));
        }
        if (kindStr === 'counting') return I(data.length);
        if (kindStr === 'toSet') return makeSet(dedupe(data));
        return makeList(data);
      }
      case 'count': return I(evalStream(nat.items, nat.ops as any).length);
      case 'max': {
        const d = evalStream(nat.items, nat.ops as any);
        if (!d.length) return makeOptional(null);
        return makeOptional(d.reduce((a, b) => (((a.k === 'pri' ? numOf(a) : stringOf(a)) >= (b.k === 'pri' ? numOf(b) : stringOf(b))) ? a : b)));
      }
      case 'min': {
        const d = evalStream(nat.items, nat.ops as any);
        if (!d.length) return makeOptional(null);
        return makeOptional(d.reduce((a, b) => (((a.k === 'pri' ? numOf(a) : stringOf(a)) <= (b.k === 'pri' ? numOf(b) : stringOf(b))) ? a : b)));
      }
      case 'sum': return I(evalStream(nat.items, nat.ops as any).reduce((a, x) => (a + numOf(x)) | 0, 0));
      case 'average': {
        const d = evalStream(nat.items, nat.ops as any);
        if (!d.length) return makeOptional(null);
        return makeOptional(D(d.reduce((a, x) => a + numOf(x), 0) / d.length));
      }
      case 'forEach':
        for (const x of evalStream(nat.items, nat.ops as any)) h.callFn(args[0], [x]);
        return jNull;
      case 'anyMatch': {
        for (const x of evalStream(nat.items, nat.ops as any)) if (boolOf(h.callFn(args[0], [x]))) return bool(true);
        return bool(false);
      }
      case 'allMatch': {
        for (const x of evalStream(nat.items, nat.ops as any)) if (!boolOf(h.callFn(args[0], [x]))) return bool(false);
        return bool(true);
      }
      case 'noneMatch': {
        for (const x of evalStream(nat.items, nat.ops as any)) if (boolOf(h.callFn(args[0], [x]))) return bool(false);
        return bool(true);
      }
      case 'findFirst': {
        const d = evalStream(nat.items, nat.ops as any);
        return makeOptional(d.length ? d[0] : null);
      }
      case 'toList': return makeList(evalStream(nat.items, nat.ops as any));
      default:
        return NOT_NATIVE;
    }
  }

  /* Iterator */
  if (nat?.kind === 'iterator') {
    switch (name) {
      case 'hasNext': return bool(nat.index < nat.items.length);
      case 'next': {
        if (nat.index >= nat.items.length) throw makeException('NoSuchElementException', 'Iterator exhausted');
        return nat.items[nat.index++];
      }
      default: return NOT_NATIVE;
    }
  }

  /* Throwable */
  if (nat?.kind === 'throwable') {
    switch (name) {
      case 'getMessage': return nat.message === null ? jNull : newString(nat.message);
      case 'toString': return newString(display(recv));
      case 'getClass':
        return newObj('Class', { kind: 'class', name: obj.type });
      default: return NOT_NATIVE;
    }
  }

  /* Object */
  switch (name) {
    case 'toString':
      return newString(display(recv));
    case 'hashCode':
      return I(obj.id | 0);
    case 'equals':
      return bool(args[0].k === 'obj' && args[0].id === obj.id);
    case 'getClass':
      return newObj('Class', { kind: 'class', name: obj.type });
    default:
      return NOT_NATIVE;
  }
}

function boolOf(v: JValue): boolean {
  return v.k === 'pri' && v.t === 'boolean' && (v.v as boolean);
}

function dedupe(items: JValue[]): JValue[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = hashKey(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export { makeException };
