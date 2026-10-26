/** Runtime values, environments and formatting for the teaching interpreter. */
import type { Body, CosmosApi, WorldState } from '../world';
import type { Dialect } from './ast';

export interface RuntimeApi {
  output(line: string): void;
  readonly world: WorldState;
  readonly cosmos: CosmosApi;
  readonly dialect: Dialect;
  makeBodyValue(body: Body): Value;
  hash01(i: number, seed: number): number;
}

export interface ObjBridge {
  get(name: string): Value | undefined;
  set(name: string, value: Value): boolean;
}

export type Value =
  | { t: 'num'; v: number; int: boolean }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'arr'; v: Value[] }
  | { t: 'obj'; id: number; className: string; fields: Map<string, Value>; bridge?: ObjBridge }
  | { t: 'tagged'; tag: string; v: Value }
  | { t: 'null' }
  | { t: 'class'; name: string }
  | { t: 'builtin'; name: string; fn: (args: Value[], rt: RuntimeApi) => Value; receiver?: Value };

export interface FnValue {
  kind: 'func';
  name: string;
  params: string[];
  body: import('./ast').Stmt[];
  closure: Env;
  thisVal?: Value;
  superName?: string | null;
  className?: string;
}

/** Function-like values are stored as objects so `Value` stays a flat union. */
export type FuncLike = FnValue;

let nextObjId = 1;

export function num(v: number, int = false): Value {
  return { t: 'num', v, int };
}
export function str(v: string): Value {
  return { t: 'str', v };
}
export function bool(v: boolean): Value {
  return { t: 'bool', v };
}
export const NULL: Value = { t: 'null' };

export function makeObj(className: string, bridge?: ObjBridge): Extract<Value, { t: 'obj' }> {
  return { t: 'obj', id: nextObjId++, className, fields: new Map(), ...(bridge ? { bridge } : {}) };
}

export function tagged(tag: string, v: Value = NULL): Value {
  return { t: 'tagged', tag, v };
}

export interface Binding {
  value: Value;
  mutable: boolean;
}

export class Env {
  private readonly vars = new Map<string, Binding>();

  constructor(readonly parent: Env | null = null, readonly label = 'local') {}

  declare(name: string, value: Value, mutable: boolean): void {
    this.vars.set(name, { value, mutable });
  }

  get(name: string): Value | undefined {
    const local = this.vars.get(name);
    if (local) return local.value;
    return this.parent?.get(name);
  }

  lookupBinding(name: string): Binding | undefined {
    return this.vars.get(name) ?? this.parent?.lookupBinding(name);
  }

  set(name: string, value: Value): boolean {
    const local = this.vars.get(name);
    if (local) {
      if (!local.mutable) return false;
      local.value = value;
      return true;
    }
    if (this.parent) return this.parent.set(name, value);
    return false;
  }

  hasOwn(name: string): boolean {
    return this.vars.has(name);
  }

  /** Only this frame (no parents) — used to separate learner variables from runtime builtins. */
  ownEntries(): Array<[string, Value]> {
    return [...this.vars.entries()].map(([k, b]) => [k, b.value]);
  }

  /** Compact, deterministic snapshot for the debugger / trace panel. */
  snapshot(limit = 24): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    let env: Env | null = this;
    let guard = 0;
    while (env && out.length < limit && guard++ < 8) {
      for (const [k, b] of env.vars) {
        if (out.length >= limit) break;
        if (out.some(([name]) => name === k)) continue;
        out.push([k, formatValue(b.value, 0)]);
      }
      env = env.parent;
    }
    return out;
  }
}

export function formatValue(v: Value, depth = 0): string {
  if (depth > 3) return '…';
  switch (v.t) {
    case 'num':
      if (!Number.isFinite(v.v)) return String(v.v);
      return !v.int && Number.isInteger(v.v) ? `${v.v}.0` : String(Number(v.v.toFixed(6)));
    case 'str':
      return depth === 0 ? v.v : `"${v.v}"`;
    case 'bool':
      return String(v.v);
    case 'null':
      return 'null';
    case 'arr':
      return `[${v.v.slice(0, 12).map((x) => formatValue(x, depth + 1)).join(', ')}${v.v.length > 12 ? ', …' : ''}]`;
    case 'tagged':
      return v.tag === 'None' && v.v.t === 'null' ? 'None' : `${v.tag}(${formatValue(v.v, depth + 1)})`;
    case 'class':
      return `class ${v.name}`;
    case 'builtin':
      return `<fn ${v.name}>`;
    case 'obj': {
      if (v.className === 'Body') {
        const label = v.fields.get('label');
        return label && label.t === 'str' && label.v ? `Body(${label.v})` : `Body#${v.id}`;
      }
      const parts: string[] = [];
      for (const [k, val] of v.fields) {
        if (parts.length >= 5) break;
        parts.push(`${k}=${formatValue(val, depth + 1)}`);
      }
      return `${v.className}(${parts.join(', ')})`;
    }
  }
}

export function truthy(v: Value): boolean {
  switch (v.t) {
    case 'bool': return v.v;
    case 'num': return v.v !== 0;
    case 'null': return false;
    case 'str': return v.v.length > 0;
    default: return true;
  }
}

export function toNumber(v: Value): number {
  if (v.t === 'num') return v.v;
  if (v.t === 'bool') return v.v ? 1 : 0;
  if (v.t === 'null') return 0;
  if (v.t === 'str') {
    const n = Number(v.v);
    return Number.isFinite(n) ? n : 0;
  }
  return NaN;
}

export function valuesEqual(a: Value, b: Value): boolean {
  if (a.t === 'num' && b.t === 'num') return a.v === b.v;
  if (a.t === 'str' && b.t === 'str') return a.v === b.v;
  if (a.t === 'bool' && b.t === 'bool') return a.v === b.v;
  if (a.t === 'null' && b.t === 'null') return true;
  if (a.t === 'arr' && b.t === 'arr') {
    return a.v.length === b.v.length && a.v.every((x, i) => valuesEqual(x, b.v[i] as Value));
  }
  if (a.t === 'tagged' && b.t === 'tagged') return a.tag === b.tag && valuesEqual(a.v, b.v);
  if (a.t === 'obj' && b.t === 'obj') return a.id === b.id;
  return false;
}

/** Substitute `{}` placeholders in Rust-style format strings. */
export function formatPrint(template: string, args: Value[]): string {
  let i = 0;
  const out = template.replace(/\{\:?[^}]*\}/g, () => {
    const a = args[i++];
    return a ? formatValue(a, 0) : '';
  });
  // Positional forms like {0} are rare in lessons; handle the common case.
  return out;
}
