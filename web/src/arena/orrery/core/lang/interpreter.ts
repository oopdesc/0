/**
 * ORRERY teaching runtime.
 *
 * HONESTY CONTRACT (also documented in README):
 * This is a small, deterministic tree-walking interpreter for a documented
 * SUBSET of Java and Rust surface syntax. It is NOT javac, NOT a JVM, NOT rustc.
 * Curated Java labs additionally ship JVM-verified reference outputs produced
 * by `scripts/verify-java.sh` (real javac/java). Where a construct is not
 * executable here (records, sealed types, lifetimes, traits), lessons say so
 * explicitly and teach it by reading + prediction rather than by faking a run.
 */
import type {
  ClassDef, Dialect, Expr, LangError, MatchPattern, MethodDef, Pos, Program, Stmt, TraceStep, RunResult,
} from './ast';
import { parse } from './parser';
import { typeCategory } from './lexer';
import { hash01 } from '../rng';
import { makeCosmosApi, safeColor, type Body, type WorldState } from '../world';
import {
  bool, Env, formatPrint, formatValue, makeObj, num, str, tagged, toNumber, truthy, valuesEqual,
  NULL, type RuntimeApi, type Value,
} from './values';

export interface RunOptions {
  dialect: Dialect;
  world: WorldState;
  hash01?: (i: number, seed: number) => number;
  maxSteps?: number;
  maxOutput?: number;
  borrowErrors?: LangError[];
}

interface Frame {
  env: Env;
  thisVal: Value;
  className: string | null;
  superClass: string | null;
}

interface ClassRuntime {
  name: string;
  def: ClassDef;
  parent: ClassRuntime | null;
}

class RuntimeFailure extends Error {
  constructor(readonly langError: LangError) {
    super(langError.message);
  }
}
class ReturnSignal {
  constructor(readonly value: Value) {}
}
class BreakSignal {}
class ContinueSignal {}

const MAX_TRACE = 220;
const MAX_LOOP_ITERATIONS = 5000;
const MAX_DEPTH = 48;

export function runProgram(source: string, opts: RunOptions): RunResult {
  const started = Date.now();
  const dialect = opts.dialect;
  const base: Omit<RunResult, 'ok' | 'errors' | 'trace' | 'output' | 'bodyCount' | 'elapsedMs' | 'locals'> = { dialect };

  if (opts.borrowErrors && opts.borrowErrors.length > 0) {
    return { ...base, ok: false, errors: opts.borrowErrors, output: [], trace: [], bodyCount: opts.world.bodies.length, elapsedMs: 0, locals: [] };
  }

  const { program, error } = parse(source, dialect);
  if (!program || error) {
    return {
      ...base, ok: false, errors: error ? [error] : [{ message: '構文解析に失敗しました', line: 1, col: 1, phase: 'parse' }],
      output: [], trace: [], bodyCount: opts.world.bodies.length, elapsedMs: Date.now() - started, locals: [],
    };
  }

  const output: string[] = [];
  const trace: TraceStep[] = [];
  const cosmos = makeCosmosApi(opts.world);
  const hash = opts.hash01 ?? hash01;
  const rt: RuntimeApi = {
    output(line) {
      if (output.length < (opts.maxOutput ?? 200)) output.push(String(line).slice(0, 400));
    },
    world: opts.world,
    cosmos,
    dialect,
    hash01: hash,
    makeBodyValue: (b) => makeBodyValue(b),
  };

  const machine = new Interpreter(program, rt, output, trace, opts.maxSteps ?? 20000, opts.maxOutput ?? 200, hash);
  let errors: LangError[] = [];
  let locals: Array<[string, string]> = [];
  try {
    machine.run();
    locals = machine.userLocals();
  } catch (e) {
    if (e instanceof RuntimeFailure) errors = [e.langError];
    else if (e instanceof Error) errors = [{ message: `実行時エラー: ${e.message}`, line: 1, col: 1, phase: 'runtime' }];
    else errors = [{ message: '不明な実行時エラー', line: 1, col: 1, phase: 'runtime' }];
  }

  return {
    ...base,
    ok: errors.length === 0,
    errors,
    output,
    trace,
    bodyCount: opts.world.bodies.length,
    elapsedMs: Date.now() - started,
    locals,
  };
}

/** A live handle to a celestial body; assignments reach the actual simulation. */
function makeBodyValue(body: Body): Value {
  const obj = makeObj('Body', {
    get(name) {
      switch (name) {
        case 'x': return num(body.x, false);
        case 'y': return num(body.y, false);
        case 'vx': return num(body.vx, false);
        case 'vy': return num(body.vy, false);
        case 'mass': return num(body.mass, false);
        case 'radius': case 'size': return num(body.radius, false);
        case 'color': return str(body.color);
        case 'label': return str(body.label);
        case 'fixed': return bool(body.fixed);
        default: return undefined;
      }
    },
    set(name, value) {
      const n = toNumber(value);
      switch (name) {
        case 'x': body.x = n; return true;
        case 'y': body.y = n; return true;
        case 'vx': body.vx = n; return true;
        case 'vy': body.vy = n; return true;
        case 'mass': body.mass = Math.max(0.01, n); return true;
        case 'radius': case 'size': body.radius = Math.max(0.2, n); return true;
        case 'color': if (value.t === 'str') { body.color = safeColor(value.v, body.color); return true; } return false;
        case 'label': if (value.t === 'str') { body.label = value.v.slice(0, 40); return true; } return false;
        default: return false;
      }
    },
  });
  obj.fields.set('label', str(body.label));
  return obj;
}

class Interpreter {
  readonly globalEnv = new Env(null, 'global');
  private readonly classes = new Map<string, ClassRuntime>();
  private readonly functions = new Map<string, { params: string[]; body: Stmt[] }>();
  private steps = 0;
  private depth = 0;
  private lastValue: Value = NULL;
  private readonly builtinNames = new Set<string>();

  /** Only variables the learner declared — not the runtime's built-in library. */
  userLocals(): Array<[string, string]> {
    const skip = new Set(['this', 'self', 'args']);
    return this.globalEnv.ownEntries()
      .filter(([name, value]) => !this.builtinNames.has(name) && !skip.has(name)
        && value.t !== 'builtin' && value.t !== 'class')
      .slice(0, 20)
      .map(([name, value]) => [name, formatValue(value, 1).slice(0, 80)]);
  }

  constructor(
    private readonly program: Program,
    private readonly rt: RuntimeApi,
    private readonly output: string[],
    private readonly trace: TraceStep[],
    private readonly maxSteps: number,
    private readonly maxOutput: number,
    private readonly hash: (i: number, seed: number) => number,
  ) {}

  run(): void {
    this.installBuiltins();
    this.hoist();
    const frame: Frame = { env: this.globalEnv, thisVal: NULL, className: null, superClass: null };
    for (const stmt of this.program.statements) {
      if (stmt.k === 'class' || stmt.k === 'fn') continue; // hoisted
      this.execStmt(stmt, frame);
    }
    // Entry point: Java `class Main { static void main(...) }` or Rust `fn main()`.
    const mainClass = [...this.classes.values()].find((c) => c.def.methods.some((m) => m.name === 'main' && m.isStatic));
    if (mainClass) {
      const m = mainClass.def.methods.find((x) => x.name === 'main' && x.isStatic)!;
      this.invokeUser('main', m.params.map((p) => p.name), m.body ?? [], this.globalEnv, [], frame, NULL, mainClass.name, mainClass.parent?.name ?? null);
    } else {
      const fn = this.functions.get('main');
      if (fn) this.invokeUser('main', fn.params, fn.body, this.globalEnv, [], frame, NULL, null, null);
    }
  }

  // ---- declarations ------------------------------------------------------

  private hoist(): void {
    for (const stmt of this.program.statements) {
      if (stmt.k === 'fn') this.functions.set(stmt.name, { params: stmt.params.map((p) => p.name), body: stmt.body });
      if (stmt.k === 'class') {
        const existing = this.classes.get(stmt.def.name);
        if (existing) {
          existing.def.methods.push(...stmt.def.methods); // Rust `impl` merge
          if (stmt.def.superName) existing.def.superName = stmt.def.superName;
        } else {
          this.classes.set(stmt.def.name, { name: stmt.def.name, def: { ...stmt.def, methods: [...stmt.def.methods] }, parent: null });
        }
      }
    }
    for (const cls of this.classes.values()) {
      if (cls.def.superName) cls.parent = this.classes.get(cls.def.superName) ?? null;
      for (const variant of cls.def.variants) {
        const tag = variant;
        this.globalEnv.declare(tag, {
          t: 'builtin', name: tag,
          fn: (args) => tagged(tag, args[0] ?? NULL),
        }, true);
      }
    }
    for (const [name, def] of this.functions) {
      this.globalEnv.declare(name, this.functionValue(name, def.params, def.body, this.globalEnv, NULL, null, null), true);
    }
  }

  private findMethod(cls: ClassRuntime | null, name: string): { method: MethodDef; owner: ClassRuntime } | null {
    let cur = cls;
    let guard = 0;
    while (cur && guard++ < 16) {
      const m = cur.def.methods.find((x) => x.name === name);
      if (m) return { method: m, owner: cur };
      cur = cur.parent;
    }
    return null;
  }

  private methodValue(method: MethodDef, owner: ClassRuntime, closure: Env, thisVal: Value): Value {
    return this.functionValue(method.name, method.params.map((p) => p.name), method.body ?? [], closure, thisVal, owner.name, owner.parent?.name ?? null);
  }

  private functionValue(
    name: string, params: string[], body: Stmt[], closure: Env,
    thisVal: Value, className: string | null, superClass: string | null,
  ): Value {
    return {
      t: 'builtin', name,
      fn: (args, _rt) => {
        const parentFrame: Frame = { env: closure, thisVal, className, superClass };
        return this.invokeUser(name, params, body, closure, args, parentFrame, thisVal, className, superClass);
      },
    };
  }

  private invokeUser(
    name: string, params: string[], body: Stmt[], closure: Env, args: Value[],
    _parent: Frame, thisVal: Value, className: string | null, superClass: string | null,
  ): Value {
    if (this.depth > MAX_DEPTH) throw new RuntimeFailure({ message: `呼び出しの深さが上限 (${MAX_DEPTH}) を超えました。再帰を確認してください。`, line: 1, col: 1, phase: 'runtime' });
    const env = new Env(closure, name);
    params.forEach((p, i) => {
      const v = args[i] ?? NULL;
      env.declare(p, v, true);
      if (p === 'self' || p === 'this') {
        env.declare('this', thisVal, true);
        env.declare('self', thisVal, true);
      }
    });
    if (!env.hasOwn('this')) {
      env.declare('this', thisVal, true);
      env.declare('self', thisVal, true);
    }
    const frame: Frame = { env, thisVal, className, superClass };
    this.depth++;
    try {
      this.execStmts(body, frame);
      return NULL;
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    } finally {
      this.depth--;
    }
  }

  // ---- builtins ----------------------------------------------------------

  private builtin(name: string, fn: (args: Value[], rt: RuntimeApi) => Value): Value {
    return { t: 'builtin', name, fn };
  }

  private installBuiltins(): void {
    const e = this.globalEnv;

    const printer = (name: string) => this.builtin(name, (args) => {
      const first = args[0];
      let line: string;
      if (first && first.t === 'str' && /\{/.test(first.v)) line = formatPrint(first.v, args.slice(1));
      else line = args.map((a) => formatValue(a, 0)).join(' ');
      if (this.output.length < this.maxOutput) this.rt.output(line);
      return NULL;
    });
    e.declare('print', printer('print'), true);
    e.declare('println', printer('println'), true);
    e.declare('dbg', printer('dbg'), true);
    e.declare('echo', printer('echo'), true);
    e.declare('format', this.builtin('format', (args) => {
      const t = args[0];
      return t && t.t === 'str' ? str(formatPrint(t.v, args.slice(1))) : str('');
    }), true);
    e.declare('vec', this.builtin('vec', (args) => ({ t: 'arr', v: [...args] })), true);
    e.declare('assert_eq', this.builtin('assert_eq', (args) => {
      if (!valuesEqual(args[0] ?? NULL, args[1] ?? NULL)) {
        throw new RuntimeFailure({ message: `assert_eq! 失敗: 左=${formatValue(args[0] ?? NULL)} / 右=${formatValue(args[1] ?? NULL)}`, line: 1, col: 1, phase: 'runtime' });
      }
      return NULL;
    }), true);
    e.declare('panic', this.builtin('panic', (args) => {
      throw new RuntimeFailure({ message: `panic!: ${args.map((a) => formatValue(a, 0)).join(' ')}`, line: 1, col: 1, phase: 'runtime' });
    }), true);
    e.declare('todo', this.builtin('todo', () => {
      throw new RuntimeFailure({ message: 'todo! は未実装です。自分で実装してください。', line: 1, col: 1, phase: 'runtime' });
    }), true);

    const oneNum = (name: string, f: (n: number) => number) => this.builtin(name, (args) => num(f(toNumber(args[0] ?? num(0))), false));
    const twoNum = (name: string, f: (a: number, b: number) => number) => this.builtin(name, (args) => num(f(toNumber(args[0] ?? num(0)), toNumber(args[1] ?? num(0))), false));
    const mathFns: Record<string, Value> = {
      sin: oneNum('sin', Math.sin), cos: oneNum('cos', Math.cos), tan: oneNum('tan', Math.tan),
      sqrt: oneNum('sqrt', Math.sqrt), abs: oneNum('abs', Math.abs), floor: oneNum('floor', Math.floor),
      ceil: oneNum('ceil', Math.ceil), round: oneNum('round', Math.round), log: oneNum('log', Math.log),
      pow: twoNum('pow', Math.pow), min: twoNum('min', Math.min), max: twoNum('max', Math.max),
      PI: num(Math.PI, false), E: num(Math.E, false), TAU: num(Math.PI * 2, false),
    };
    for (const [k, v] of Object.entries(mathFns)) e.declare(k, v, k.length > 3 || /^[A-Z]/.test(k) ? false : true);
    const mathObj = makeObj('Math');
    for (const [k, v] of Object.entries(mathFns)) mathObj.fields.set(k, v);
    e.declare('Math', mathObj, false);
    const f64Obj = makeObj('f64');
    for (const [k, v] of Object.entries(mathFns)) f64Obj.fields.set(k, v);
    e.declare('f64', f64Obj, false);

    const outObj = makeObj('PrintStream');
    outObj.fields.set('println', printer('System.out.println'));
    outObj.fields.set('print', printer('System.out.print'));
    const systemObj = makeObj('System');
    systemObj.fields.set('out', outObj);
    e.declare('System', systemObj, false);

    const stringObj = makeObj('String');
    stringObj.fields.set('from', this.builtin('String.from', (args) => str(formatValue(args[0] ?? NULL, 0))));
    stringObj.fields.set('valueOf', this.builtin('String.valueOf', (args) => str(formatValue(args[0] ?? NULL, 0))));
    e.declare('String', stringObj, false);
    const vecObj = makeObj('Vec');
    vecObj.fields.set('new', this.builtin('Vec.new', () => ({ t: 'arr', v: [] })));
    e.declare('Vec', vecObj, false);

    e.declare('Some', this.builtin('Some', (a) => tagged('Some', a[0] ?? NULL)), false);
    e.declare('Ok', this.builtin('Ok', (a) => tagged('Ok', a[0] ?? NULL)), false);
    e.declare('Err', this.builtin('Err', (a) => tagged('Err', a[0] ?? NULL)), false);
    e.declare('None', tagged('None', NULL), false);
    e.declare('len', this.builtin('len', (a) => {
      const v = a[0];
      return num(v?.t === 'arr' ? v.v.length : v?.t === 'str' ? v.v.length : 0, true);
    }), false);
    e.declare('str', this.builtin('str', (a) => str(formatValue(a[0] ?? NULL, 0))), false);
    e.declare('noise', this.builtin('noise', (a) => num(this.hash(Math.trunc(toNumber(a[0] ?? num(0))), this.rt.world.seed), false)), false);

    // ---- cosmos API: code changes really rebuild the universe ----
    const nAt = (args: Value[], i: number, d: number) => toNumber(args[i] ?? num(d));
    const sAt = (args: Value[], i: number, d: string) => (args[i]?.t === 'str' ? (args[i] as Extract<Value, { t: 'str' }>).v : d);

    const cosmosBuiltins: Array<[string, (args: Value[], rt: RuntimeApi) => Value]> = [
      ['clear', (_a, rt) => { rt.cosmos.clear(); return NULL; }],
      ['star', (a, rt) => this.rt.makeBodyValue(rt.cosmos.star(nAt(a, 0, 0), nAt(a, 1, 0), nAt(a, 2, 1200), sAt(a, 3, '#f4c07a'), sAt(a, 4, 'Star')))],
      ['planet', (a, rt) => this.rt.makeBodyValue(rt.cosmos.planet(nAt(a, 0, 0), nAt(a, 1, 0), nAt(a, 2, 4), sAt(a, 3, '#79c7bd'), sAt(a, 4, ''), nAt(a, 5, 0), nAt(a, 6, 0)))],
      ['particle', (a, rt) => {
        const b = rt.cosmos.particle(nAt(a, 0, 0), nAt(a, 1, 0), nAt(a, 2, 0), nAt(a, 3, 0), sAt(a, 4, '#e8f1f2'), nAt(a, 5, 1.4));
        return b ? this.rt.makeBodyValue(b) : NULL;
      }],
      ['orbit', (a, rt) => num(rt.cosmos.orbit(nAt(a, 0, 0), nAt(a, 1, 0), nAt(a, 2, 80), nAt(a, 3, 6), nAt(a, 4, 0.6), sAt(a, 5, '#c8cfd2'), nAt(a, 6, 0)), true)],
      ['spiral', (a, rt) => num(rt.cosmos.spiral(nAt(a, 0, 3), nAt(a, 1, 480), nAt(a, 2, 220), nAt(a, 3, 2.4), sAt(a, 4, '#a9c9e8')), true)],
      ['dust', (a, rt) => num(rt.cosmos.dust(nAt(a, 0, 200), nAt(a, 1, 180), sAt(a, 2, '#8fa8b8')), true)],
      ['gravity', (a, rt) => { rt.cosmos.gravity(nAt(a, 0, 1)); return NULL; }],
      ['timeScale', (a, rt) => { rt.cosmos.timeScale(nAt(a, 0, 1)); return NULL; }],
      ['trails', (a, rt) => { rt.cosmos.trails(truthy(a[0] ?? bool(true))); return NULL; }],
      ['background', (a, rt) => { rt.cosmos.background(sAt(a, 0, '#080b10')); return NULL; }],
      ['bodyCount', (_a, rt) => num(rt.world.bodies.length, true)],
    ];
    for (const [name, fn] of cosmosBuiltins) {
      const v = this.builtin(name, fn);
      e.declare(name, v, false);
    }
    this.registerCosmosAliases(e);
    // Everything installed above is runtime plumbing, not learner state.
    for (const [name] of e.ownEntries()) this.builtinNames.add(name);
  }

  private registerCosmosAliases(e: Env): void {
    const aliases: Record<string, string> = {
      add_star: 'star', add_planet: 'planet', make_orbit: 'orbit', make_spiral: 'spiral',
      make_dust: 'dust', set_gravity: 'gravity', set_time_scale: 'timeScale', set_trails: 'trails',
      set_background: 'background', add_particle: 'particle', clear_world: 'clear', count_bodies: 'bodyCount',
      addStar: 'star', addPlanet: 'planet', makeOrbit: 'orbit', makeSpiral: 'spiral',
      setGravity: 'gravity', setTimeScale: 'timeScale', setTrails: 'trails', body_count: 'bodyCount',
    };
    for (const [alias, target] of Object.entries(aliases)) {
      const v = e.get(target);
      if (v) e.declare(alias, v, false);
    }
  }

  // ---- statements --------------------------------------------------------

  private tick(pos: Pos): void {
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw new RuntimeFailure({ message: `実行ステップ上限 (${this.maxSteps}) を超えました。無限ループになっていないか確認してください。`, line: pos.line, col: pos.col, phase: 'runtime' });
    }
  }

  private record(pos: Pos, label: string, env: Env): void {
    if (this.trace.length >= MAX_TRACE) return;
    this.trace.push({
      index: this.trace.length,
      line: pos.line,
      label: label.slice(0, 90),
      vars: env.snapshot(40)
        .filter(([name]) => !this.builtinNames.has(name) && name !== 'this' && name !== 'self' && name !== 'args')
        .slice(0, 8),
      outputCount: this.output.length,
      bodyCount: this.rt.world.bodies.length,
    });
  }

  private execStmts(stmts: Stmt[], f: Frame): void {
    for (const s of stmts) this.execStmt(s, f);
  }

  private execStmt(stmt: Stmt, f: Frame): void {
    this.tick(stmt.pos);
    switch (stmt.k) {
      case 'class':
      case 'fn':
        return;
      case 'block': {
        const child = new Env(f.env, 'block');
        this.execStmts(stmt.body, { ...f, env: child });
        return;
      }
      case 'var': {
        let value = stmt.init ? this.evalExpr(stmt.init, f) : NULL;
        const cat = typeCategory(stmt.typeName);
        if (value.t === 'num') {
          if (cat === 'int') value = num(Math.trunc(value.v), true);
          else if (cat === 'float') value = num(value.v, false);
        }
        f.env.declare(stmt.name, value, stmt.mutable);
        this.record(stmt.pos, `${stmt.name} = ${formatValue(value)}`, f.env);
        return;
      }
      case 'expr': {
        this.lastValue = this.evalExpr(stmt.expr, f);
        this.record(stmt.pos, this.exprLabel(stmt.expr), f.env);
        return;
      }
      case 'if': {
        if (truthy(this.evalExpr(stmt.cond, f))) this.execStmts(stmt.then, { ...f, env: new Env(f.env, 'if') });
        else this.execStmts(stmt.otherwise, { ...f, env: new Env(f.env, 'else') });
        return;
      }
      case 'while': {
        let iterations = 0;
        while (truthy(this.evalExpr(stmt.cond, f))) {
          if (++iterations > MAX_LOOP_ITERATIONS) this.fail('ループ回数が上限を超えました。終了条件を確認してください。', stmt.pos);
          this.tick(stmt.pos);
          try {
            this.execStmts(stmt.body, { ...f, env: new Env(f.env, 'while') });
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case 'for': {
        const scope = new Env(f.env, 'for');
        const ff: Frame = { ...f, env: scope };
        if (stmt.init) this.execStmt(stmt.init, ff);
        let iterations = 0;
        while (stmt.cond ? truthy(this.evalExpr(stmt.cond, ff)) : true) {
          if (++iterations > MAX_LOOP_ITERATIONS) this.fail('ループ回数が上限を超えました。終了条件を確認してください。', stmt.pos);
          this.tick(stmt.pos);
          try {
            this.execStmts(stmt.body, { ...ff, env: new Env(scope, 'for-body') });
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) { /* fall through to update */ }
            else throw e;
          }
          if (stmt.update) this.evalExpr(stmt.update, ff);
        }
        return;
      }
      case 'forIn': {
        const iterable = this.evalExpr(stmt.iterable, f);
        const items = this.iterableValues(iterable, stmt.pos);
        for (const item of items) {
          this.tick(stmt.pos);
          const scope = new Env(f.env, 'for-in');
          scope.declare(stmt.name, item, true);
          try {
            this.execStmts(stmt.body, { ...f, env: scope });
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case 'return': {
        const v = stmt.expr ? this.evalExpr(stmt.expr, f) : NULL;
        throw new ReturnSignal(v);
      }
      case 'break':
        throw new BreakSignal();
      case 'continue':
        throw new ContinueSignal();
    }
  }

  private iterableValues(v: Value, pos: Pos): Value[] {
    if (v.t === 'arr') return v.v.slice(0, MAX_LOOP_ITERATIONS);
    if (v.t === 'str') return v.v.split('').map((c) => str(c));
    if (v.t === 'obj' && v.className === 'Range') {
      const a = toNumber(v.fields.get('start') ?? num(0));
      const b = toNumber(v.fields.get('end') ?? num(0));
      const out: Value[] = [];
      const count = Math.min(MAX_LOOP_ITERATIONS, Math.max(0, Math.ceil(b - a)));
      for (let i = 0; i < count; i++) out.push(num(a + i, true));
      return out;
    }
    this.fail(`for ... in には配列・範囲・文字列が必要です（受け取ったのは ${formatValue(v)}）`, pos);
  }

  private exprLabel(e: Expr): string {
    switch (e.k) {
      case 'call': return `呼び出し ${e.callee.k === 'ident' ? e.callee.name : e.callee.k === 'member' ? `.${e.callee.name}` : '式'}`;
      case 'assign': return `代入 ${e.target.k === 'ident' ? e.target.name : 'フィールド'}`;
      case 'postfix': return `${e.op}`;
      default: return '式を評価';
    }
  }

  // ---- expressions -------------------------------------------------------

  private evalExpr(expr: Expr, f: Frame): Value {
    switch (expr.k) {
      case 'num': return num(expr.value, expr.isInt);
      case 'str': return str(expr.value);
      case 'bool': return bool(expr.value);
      case 'null': return NULL;
      case 'this': return f.thisVal;
      case 'super': return f.thisVal;
      case 'ident': {
        const v = f.env.get(expr.name);
        if (v === undefined) {
          if (this.classes.has(expr.name)) return { t: 'class', name: expr.name };
          this.fail(`未定義の名前です: ${expr.name}`, expr.pos);
        }
        return v;
      }
      case 'array': return { t: 'arr', v: expr.items.map((x) => this.evalExpr(x, f)) };
      case 'range': {
        const from = this.evalExpr(expr.from, f);
        const to = this.evalExpr(expr.to, f);
        const o = makeObj('Range');
        o.fields.set('start', from);
        o.fields.set('end', to);
        return o;
      }
      case 'unary': {
        const v = this.evalExpr(expr.arg, f);
        switch (expr.op) {
          case '!': return bool(!truthy(v));
          case '-': { const n = toNumber(v); return num(-n, v.t === 'num' && v.int); }
          case '+': return num(toNumber(v), v.t === 'num' && v.int);
          case '&': return v; // educational: references are not tracked as values
          case '~': return v;
          default: return NULL;
        }
      }
      case 'binary': return this.evalBinary(expr, f);
      case 'ternary': return truthy(this.evalExpr(expr.cond, f)) ? this.evalExpr(expr.then, f) : this.evalExpr(expr.otherwise, f);
      case 'assign': {
        const rhs = this.evalExpr(expr.value, f);
        const value = expr.op === '=' ? rhs : this.applyBinary(expr.op.slice(0, 1), this.readTarget(expr.target, f), rhs, expr.pos);
        this.writeTarget(expr.target, value, f, expr.pos);
        return value;
      }
      case 'postfix': {
        const old = this.readTarget(expr.arg, f);
        const delta = expr.op === '++' ? 1 : -1;
        const next = num(toNumber(old) + delta, old.t === 'num' && old.int);
        this.writeTarget(expr.arg, next, f, expr.pos);
        return old;
      }
      case 'member': return this.getMember(this.evalExpr(expr.obj, f), expr.name, f, expr.pos, expr.obj);
      case 'index': {
        const obj = this.evalExpr(expr.obj, f);
        const idx = Math.trunc(toNumber(this.evalExpr(expr.index, f)));
        if (obj.t === 'arr') {
          if (idx < 0 || idx >= obj.v.length) this.fail(`index ${idx} は範囲外です（要素数 ${obj.v.length}）`, expr.pos);
          return obj.v[idx] as Value;
        }
        if (obj.t === 'str') {
          if (idx < 0 || idx >= obj.v.length) this.fail(`index ${idx} は範囲外です（長さ ${obj.v.length}）`, expr.pos);
          return str(obj.v[idx] as string);
        }
        this.fail(`[] は配列または文字列にのみ使えます`, expr.pos);
      }
      case 'call': return this.evalCall(expr, f);
      case 'new': return this.instantiate(expr.className, expr.args.map((a) => this.evalExpr(a, f)), f, expr.pos);
      case 'match': return this.evalMatch(expr, f);
      case 'blockExpr': {
        const child = new Env(f.env, 'match-arm');
        const before = this.lastValue;
        this.lastValue = NULL;
        this.execStmts(expr.statements, { ...f, env: child });
        const result = this.lastValue;
        this.lastValue = before;
        return result;
      }
    }
  }

  private evalBinary(expr: Extract<Expr, { k: 'binary' }>, f: Frame): Value {
    const op = expr.op;
    if (op === '&&') return bool(truthy(this.evalExpr(expr.left, f)) && truthy(this.evalExpr(expr.right, f)));
    if (op === '||') return bool(truthy(this.evalExpr(expr.left, f)) || truthy(this.evalExpr(expr.right, f)));
    const a = this.evalExpr(expr.left, f);
    const b = this.evalExpr(expr.right, f);
    return this.applyBinary(op, a, b, expr.pos);
  }

  private applyBinary(op: string, a: Value, b: Value, pos: Pos): Value {
    if (op === '==') return bool(valuesEqual(a, b));
    if (op === '!=') return bool(!valuesEqual(a, b));
    if (op === '+' && (a.t === 'str' || b.t === 'str') && (a.t === 'str' || b.t === 'str')) {
      return str(formatValue(a, 0) + formatValue(b, 0));
    }
    if (['<', '>', '<=', '>='].includes(op)) {
      if (a.t === 'str' && b.t === 'str') {
        const cmp = a.v.localeCompare(b.v);
        return bool(op === '<' ? cmp < 0 : op === '>' ? cmp > 0 : op === '<=' ? cmp <= 0 : cmp >= 0);
      }
      const x = toNumber(a);
      const y = toNumber(b);
      return bool(op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y);
    }
    const x = toNumber(a);
    const y = toNumber(b);
    const bothInt = a.t === 'num' && b.t === 'num' && a.int && b.int;
    switch (op) {
      case '+': return num(x + y, bothInt);
      case '-': return num(x - y, bothInt);
      case '*': return num(x * y, bothInt);
      case '/':
        if (y === 0) {
          if (bothInt) this.fail('整数を 0 で割ると ArithmeticException になります', pos);
          return num(x > 0 ? Infinity : -Infinity, false);
        }
        return num(bothInt ? Math.trunc(x / y) : x / y, bothInt);
      case '%':
        if (y === 0) this.fail('0 で割ることはできません', pos);
        return num(bothInt ? Math.trunc(x % y) : x % y, bothInt);
      default: this.fail(`未対応の演算子です: ${op}`, pos);
    }
  }

  private evalCall(expr: Extract<Expr, { k: 'call' }>, f: Frame): Value {
    const args = expr.args.map((a) => this.evalExpr(a, f));
    if (expr.callee.k === 'member') {
      const isSuper = expr.callee.obj.k === 'super';
      const recv = isSuper ? f.thisVal : this.evalExpr(expr.callee.obj, f);
      let fnVal: Value;
      if (isSuper) {
        const parentName = f.superClass;
        const parent = parentName ? this.classes.get(parentName) ?? null : null;
        const found = this.findMethod(parent, expr.callee.name);
        if (!found) this.fail(`super.${expr.callee.name}() が見つかりません`, expr.pos);
        fnVal = this.methodValue(found!.method, found!.owner, f.env, f.thisVal);
      } else {
        fnVal = this.getMember(recv, expr.callee.name, f, expr.pos, expr.callee.obj);
      }
      return this.callValue(fnVal, args, expr.pos);
    }
    const callee = this.evalExpr(expr.callee, f);
    return this.callValue(callee, args, expr.pos);
  }

  private callValue(fnVal: Value, args: Value[], pos: Pos): Value {
    if (fnVal.t === 'builtin') return fnVal.fn(args, this.rt);
    if (fnVal.t === 'class') return this.instantiate(fnVal.name, args, { env: this.globalEnv, thisVal: NULL, className: null, superClass: null }, pos);
    this.fail(`関数ではない値を呼び出そうとしました: ${formatValue(fnVal)}`, pos);
  }

  private instantiate(className: string, args: Value[], f: Frame, pos: Pos): Value {
    const cls = this.classes.get(className);
    if (!cls) this.fail(`クラス ${className} は定義されていません`, pos);
    const inst = makeObj(className);
    let cur: ClassRuntime | null = cls;
    let guard = 0;
    while (cur && guard++ < 16) {
      for (const fd of cur.def.fields) inst.fields.set(fd.name, NULL);
      cur = cur.parent;
    }
    const ctor = this.findMethod(cls, 'constructor') ?? this.findMethod(cls, className);
    if (ctor && ctor.method.body) {
      const fnVal = this.methodValue(ctor.method, ctor.owner, f.env, inst);
      this.callValue(fnVal, args, pos);
    }
    return inst;
  }

  private getMember(receiver: Value, name: string, f: Frame, pos: Pos, objExpr?: Expr): Value {
    if (receiver.t === 'obj') {
      const field = receiver.fields.get(name);
      if (field) return field;
      const bridged = receiver.bridge?.get(name);
      if (bridged) return bridged;
      if (name === 'toString' || name === 'to_string' || name === 'fmt') {
        return this.builtin(name, () => str(formatValue(receiver, 0)));
      }
      if (name === 'len' || name === 'length') return num(receiver.fields.size, true);
      const cls = this.classes.get(receiver.className);
      if (cls) {
        const found = this.findMethod(cls, name);
        if (found) return this.methodValue(found.method, found.owner, f.env, receiver);
      }
      this.fail(`${receiver.className} にフィールド／メソッド "${name}" はありません`, pos);
    }
    if (receiver.t === 'class') {
      const cls = this.classes.get(receiver.name);
      if (cls) {
        for (const m of cls.def.methods) {
          if (m.name === name) return this.methodValue(m, cls, f.env, NULL);
        }
        for (const v of cls.def.variants) {
          if (v === name) return this.builtin(v, (a) => tagged(v, a[0] ?? NULL));
        }
      }
      this.fail(`クラス ${receiver.name} に静的メンバー "${name}" はありません`, pos);
    }
    if (receiver.t === 'arr') {
      switch (name) {
        case 'length': return num(receiver.v.length, true);
        case 'len': return this.builtin('len', () => num(receiver.v.length, true));
        case 'push': return this.builtin('push', (a) => { receiver.v.push(a[0] ?? NULL); return NULL; });
        case 'get': return this.builtin('get', (a) => receiver.v[Math.trunc(toNumber(a[0] ?? num(0)))] ?? NULL);
        case 'isEmpty': return bool(receiver.v.length === 0);
        case 'size': return num(receiver.v.length, true);
        case 'toString': return this.builtin('toString', () => str(formatValue(receiver, 0)));
      }
      this.fail(`配列にメンバー "${name}" はありません`, pos);
    }
    if (receiver.t === 'str') {
      switch (name) {
        case 'length': return num(receiver.v.length, true);
        case 'len': return this.builtin('len', () => num(receiver.v.length, true));
        case 'isEmpty': return bool(receiver.v.length === 0);
        case 'trim': return this.builtin('trim', () => str(receiver.v.trim()));
        case 'contains': return this.builtin('contains', (a) => bool(receiver.v.includes(formatValue(a[0] ?? NULL, 0))));
        case 'to_string': case 'toString': return this.builtin(name, () => str(receiver.v));
      }
      this.fail(`文字列にメンバー "${name}" はありません`, pos);
    }
    // In Rust, a bare `None` parses as the null literal. Treat it as the
    // `None` variant so Option methods behave the way a learner expects.
    const tagVal = receiver.t === 'tagged'
      ? receiver
      : receiver.t === 'null' && this.rt.dialect === 'rust'
        ? { t: 'tagged' as const, tag: 'None', v: NULL }
        : null;
    if (tagVal) {
      switch (name) {
        case 'unwrap':
          return this.builtin('unwrap', () => {
            if (tagVal.tag === 'Some' || tagVal.tag === 'Ok') return tagVal.v;
            throw new RuntimeFailure({ message: `unwrap() を ${tagVal.tag} に呼び出しました（panic）`, line: pos.line, col: pos.col, phase: 'runtime' });
          });
        case 'unwrap_or': return this.builtin('unwrap_or', (a) => (tagVal.tag === 'Some' || tagVal.tag === 'Ok') ? tagVal.v : (a[0] ?? NULL));
        case 'is_some': return this.builtin('is_some', () => bool(tagVal.tag === 'Some'));
        case 'is_none': return this.builtin('is_none', () => bool(tagVal.tag !== 'Some'));
        case 'is_ok': return this.builtin('is_ok', () => bool(tagVal.tag === 'Ok'));
        case 'is_err': return this.builtin('is_err', () => bool(tagVal.tag === 'Err'));
        case 'expect': return this.builtin('expect', (a) => {
          if (tagVal.tag === 'Some' || tagVal.tag === 'Ok') return tagVal.v;
          throw new RuntimeFailure({ message: `expect failed: ${formatValue(a[0] ?? NULL, 0)}`, line: pos.line, col: pos.col, phase: 'runtime' });
        });
      }
    }
    if (receiver.t === 'num') {
      if (name === 'to_string' || name === 'toString') return this.builtin(name, () => str(formatValue(receiver, 0)));
    }
    void objExpr;
    this.fail(`"${name}" を読み取れません（値: ${formatValue(receiver)}）`, pos);
  }

  private setMember(receiver: Value, name: string, value: Value, pos: Pos): void {
    if (receiver.t === 'obj') {
      if (receiver.bridge?.set(name, value)) {
        receiver.fields.set(name, value);
        return;
      }
      if (receiver.fields.has(name) || this.classes.has(receiver.className) || receiver.className === 'Body') {
        receiver.fields.set(name, value);
        return;
      }
      this.fail(`"${name}" に代入できません`, pos);
    }
    this.fail(`この値のフィールドには代入できません（${formatValue(receiver)}）`, pos);
  }

  private readTarget(target: Expr, f: Frame): Value {
    if (target.k === 'ident') {
      const v = f.env.get(target.name);
      if (v === undefined) this.fail(`未定義の変数です: ${target.name}`, target.pos);
      return v;
    }
    if (target.k === 'member') return this.getMember(this.evalExpr(target.obj, f), target.name, f, target.pos);
    if (target.k === 'index') return this.evalExpr(target, f);
    this.fail('代入できない対象です', target.pos);
  }

  private writeTarget(target: Expr, value: Value, f: Frame, pos: Pos): void {
    if (target.k === 'ident') {
      const binding = f.env.lookupBinding(target.name);
      if (!binding) this.fail(`未定義の変数です: ${target.name}`, pos);
      if (!binding.mutable) this.fail(`"${target.name}" は不変です。Rust では変更する変数に \`mut\` が必要です。`, pos);
      if (!f.env.set(target.name, value)) this.fail(`"${target.name}" に代入できません`, pos);
      return;
    }
    if (target.k === 'member') {
      this.setMember(this.evalExpr(target.obj, f), target.name, value, pos);
      return;
    }
    if (target.k === 'index') {
      const obj = this.evalExpr(target.obj, f);
      if (obj.t === 'arr') {
        const i = Math.trunc(toNumber(this.evalExpr(target.index, f)));
        if (i < 0 || i >= obj.v.length) this.fail(`index ${i} は範囲外です（要素数 ${obj.v.length}）`, pos);
        obj.v[i] = value;
        return;
      }
      this.fail('配列の要素にのみ代入できます', pos);
    }
    this.fail('代入できない対象です', pos);
  }

  private evalMatch(expr: Extract<Expr, { k: 'match' }>, f: Frame): Value {
    const subject = this.evalExpr(expr.subject, f);
    for (const arm of expr.arms) {
      const scope = new Env(f.env, 'match');
      if (this.matchPattern(arm.pattern, subject, scope)) {
        return this.evalExpr(arm.body, { ...f, env: scope });
      }
    }
    this.fail(`match に一致するパターンがありません（値: ${formatValue(subject)}）。網羅性を確認してください。`, expr.pos);
  }

  private matchPattern(p: MatchPattern, v: Value, env: Env): boolean {
    switch (p.k) {
      case 'wildcard': return true;
      case 'binding': env.declare(p.name, v, true); return true;
      case 'literal': return formatValue(v, 0) === p.text || String(toNumber(v)) === p.text;
      case 'variant': {
        if (p.tag === 'None' && (v.t === 'null' || (v.t === 'tagged' && v.tag === 'None'))) return true;
        if (v.t !== 'tagged' || v.tag !== p.tag) return false;
        return p.inner ? this.matchPattern(p.inner, v.v, env) : true;
      }
    }
  }

  private fail(message: string, pos: Pos): never {
    throw new RuntimeFailure({ message, line: pos.line, col: pos.col, phase: 'runtime' });
  }
}
