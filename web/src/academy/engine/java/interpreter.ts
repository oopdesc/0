/**
 * Java サブセットの実行器。
 *
 * - 文単位でトレースを残す（学習用のコード追跡表示のため）
 * - JDK と同じ出力・例外・桁あふれを再現する
 * - 無限ループ・過大出力は上限で止める（ブラウザを固めない）
 */
import type { Block, ClassDecl, CompilationUnit, Expr, FieldDecl, MethodDecl, Stmt, TypeRef } from './ast';
import { parseJava, parseJavaBody, ParseError } from './parser';
import { LexError } from './lexer';
import { checkJava } from './checker';
import {
  BreakSignal, ContinueSignal, D, I, JavaThrow, JObj, JValue, ReturnSignal, boxed, display, equalsJava,
  intAdd, intDiv, intMul, intRem, jNull, longAdd, longDiv, longMul, longRem, makeException,
  newArr, newObj, newString, pri, refEquals, toLongBig, toNumber, toStringJava, truthy,
} from './runtime';
import { callMethod, callStatic, formatJava, stringOf, Helpers, NOT_NATIVE, PrintSink } from './stdlib';

export interface TraceStep {
  i: number;
  line: number;
  kind: 'stmt' | 'call' | 'return' | 'print' | 'throw' | 'alloc';
  label: string;
  stack: string[];
  vars: [string, string][];
  outputLen: number;
}

export interface RunOptions {
  mode: 'body' | 'unit';
  trace?: boolean;
  maxSteps?: number;
  maxOutput?: number;
  sink?: PrintSink;
}

export interface RunResult {
  ok: boolean;
  output: string[];
  error: { type: string; message: string; line: number } | null;
  compileError: { message: string; line: number; col: number } | null;
  /** コンパイルエラーの分類（教材の errorCode と同じ語彙） */
  errorCode?: string;
  steps: TraceStep[];
  elapsedMs: number;
  truncated: boolean;
  stepCount: number;
}

interface Scope {
  vars: Map<string, JValue>;
  types: Map<string, string>;
  parent: Scope | null;
}

interface ClassInfo {
  decl: ClassDecl | null;
  name: string;
  superName: string | null;
  interfaces: string[];
  isInterface: boolean;
  isAbstract: boolean;
  isEnum: boolean;
  isRecord: boolean;
  fields: FieldDecl[];
  methods: MethodDecl[];
  ctors: MethodDecl[];
  enumConstants: string[];
  staticFields: Map<string, JValue>;
  staticsReady: boolean;
  enumValues: JObj[] | null;
}

const BUILTIN_PARENT: Record<string, string | null> = {
  Object: null,
  Throwable: 'Object',
  Exception: 'Throwable',
  RuntimeException: 'Exception',
  Error: 'Throwable',
  AssertionError: 'Error',
  IllegalArgumentException: 'RuntimeException',
  IllegalStateException: 'RuntimeException',
  NullPointerException: 'RuntimeException',
  ArithmeticException: 'RuntimeException',
  ClassCastException: 'RuntimeException',
  UnsupportedOperationException: 'RuntimeException',
  NumberFormatException: 'IllegalArgumentException',
  IndexOutOfBoundsException: 'RuntimeException',
  ArrayIndexOutOfBoundsException: 'IndexOutOfBoundsException',
  StringIndexOutOfBoundsException: 'IndexOutOfBoundsException',
  NoSuchElementException: 'RuntimeException',
  IllegalThreadStateException: 'IllegalArgumentException',
  InterruptedException: 'Exception',
  java_io_IOException: 'Exception',
  IOException: 'Exception',
  String: 'Object',
  Integer: 'Object',
  Long: 'Object',
  Double: 'Object',
  Float: 'Object',
  Boolean: 'Object',
  Character: 'Object',
  ArrayList: 'Object',
  List: 'Object',
  Collection: 'Object',
  Set: 'Object',
  HashSet: 'Object',
  Map: 'Object',
  HashMap: 'Object',
  Optional: 'Object',
  Stream: 'Object',
  StringBuilder: 'Object',
  Math: 'Object',
  System: 'Object',
  Arrays: 'Object',
  Collections: 'Object',
  Collectors: 'Object',
  Objects: 'Object',
  PrintStream: 'Object',
  Class: 'Object',
  Iterable: 'Object',
  Comparable: 'Object',
  Entry: 'Object',
  Comparator: 'Object',
  Function: 'Object',
  Predicate: 'Object',
  Supplier: 'Object',
  Consumer: 'Object',
  Iterator: 'Object',
};

export class Interpreter {
  classes = new Map<string, ClassInfo>();
  private steps: TraceStep[] = [];
  private output: string[] = [];
  private partial = '';
  private stepCount = 0;
  private lastScope: Scope | null = null;
  /** いま実行中のコンストラクタのクラス名（this(...) の委譲先を決める） */
  private ctorStack: string[] = [];
  private maxSteps: number;
  private maxOutput: number;
  private trace: boolean;
  private truncated = false;
  private depth = 0;
  private lineStack: number[] = [];
  private methodStack: string[] = [];
  private sink?: PrintSink;
  helpers: Helpers;

  constructor(opts: RunOptions) {
    this.maxSteps = opts.maxSteps ?? 200_000;
    this.maxOutput = opts.maxOutput ?? 800;
    this.trace = opts.trace ?? false;
    this.sink = opts.sink;
    this.helpers = {
      callFn: (fn, args) => this.callFunctionValue(fn, args, 0),
      userEquals: (o, arg) => this.userEquals(o, arg),
      userCompare: (o, arg) => this.userCompare(o, arg),
      unsupported: (what) => {
        throw makeException('UnsupportedOperationException', `${what} はこの実行モデルでは未対応です`, this.curLine());
      },
    };
  }

  /* ── 読み込み ─────────────────────────────────────── */
  load(unit: CompilationUnit) {
    for (const c of unit.classes) this.registerClass(c, null);
    // 継承関係を解決
    for (const info of this.classes.values()) {
      if (info.decl?.kind === 'record') this.synthesizeRecord(info);
      if (info.decl?.kind === 'enum') this.synthesizeEnum(info);
    }
  }

  private registerClass(decl: ClassDecl, outer: string | null) {
    const name = outer ? `${outer}$${decl.name}` : decl.name;
    const parentName = decl.superName
      ? this.resolveTypeClassName(decl.superName)
      : decl.kind === 'interface'
        ? null
        : 'Object';
    const info: ClassInfo = {
      decl,
      name,
      superName: parentName,
      interfaces: decl.interfaces.map((i) => this.resolveTypeClassName(i)),
      isInterface: decl.kind === 'interface',
      isAbstract: decl.mods.includes('abstract') || decl.kind === 'interface',
      isEnum: decl.kind === 'enum',
      isRecord: decl.kind === 'record',
      fields: decl.fields,
      methods: decl.methods,
      ctors: decl.ctors,
      enumConstants: decl.enumConstants.map((e) => e.name),
      staticFields: new Map(),
      staticsReady: false,
      enumValues: null,
    };
    this.classes.set(name, info);
    for (const n of decl.nested) this.registerClass(n, name);
  }

  private resolveTypeClassName(raw: string): string {
    const simple = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw;
    return simple;
  }

  private synthesizeRecord(info: ClassInfo) {
    const comps = info.decl!.recordComponents;
    // 正準コンストラクタ
    const ctor: MethodDecl = {
      mods: ['public'],
      name: info.name,
      ret: { name: 'void', dims: 0, pos: { line: 0, col: 0 } },
      params: comps.map((c) => ({ type: c.type, name: c.name })),
      body: {
        t: 'block',
        pos: { line: 0, col: 0 },
        body: comps.map((c) => ({
          t: 'expr' as const,
          pos: { line: 0, col: 0 },
          expr: {
            t: 'assign' as const,
            op: '=',
            pos: { line: 0, col: 0 },
            target: { t: 'field' as const, target: { t: 'this' as const, pos: { line: 0, col: 0 } }, name: c.name, pos: { line: 0, col: 0 } },
            value: { t: 'name' as const, name: c.name, pos: { line: 0, col: 0 } },
          },
        })),
      },
      throwsList: [],
      pos: { line: 0, col: 0 },
      isCtor: true,
    };
    if (!info.ctors.length) info.ctors = [ctor];
    // フィールド（private final 相当）
    info.fields = comps.map((c) => ({ mods: ['final'], type: c.type, name: c.name, init: null, pos: { line: 0, col: 0 } }));
    // アクセサ
    for (const c of comps) {
      if (info.methods.some((m) => m.name === c.name)) continue;
      info.methods.push({
        mods: ['public'],
        name: c.name,
        ret: c.type,
        params: [],
        body: {
          t: 'block', pos: { line: 0, col: 0 },
          body: [{ t: 'return', pos: { line: 0, col: 0 }, value: { t: 'field', target: { t: 'this', pos: { line: 0, col: 0 } }, name: c.name, pos: { line: 0, col: 0 } } }],
        },
        throwsList: [],
        pos: { line: 0, col: 0 },
        isCtor: false,
      });
    }
    if (!info.methods.some((m) => m.name === 'toString')) {
      info.methods.push({
        mods: ['public'], name: 'toString', ret: { name: 'String', dims: 0, pos: { line: 0, col: 0 } }, params: [],
        body: {
          t: 'block', pos: { line: 0, col: 0 },
          body: [{
            t: 'return', pos: { line: 0, col: 0 },
            value: { t: 'call', target: null, name: '__recordToString', args: [], pos: { line: 0, col: 0 } },
          }],
        },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      });
    }
    if (!info.methods.some((m) => m.name === 'equals')) {
      info.methods.push({
        mods: ['public'], name: 'equals', ret: { name: 'boolean', dims: 0, pos: { line: 0, col: 0 } },
        params: [{ type: { name: 'Object', dims: 0, pos: { line: 0, col: 0 } }, name: 'o' }],
        body: {
          t: 'block', pos: { line: 0, col: 0 },
          body: [{
            t: 'return', pos: { line: 0, col: 0 },
            value: { t: 'call', target: null, name: '__recordEquals', args: [{ t: 'name', name: 'o', pos: { line: 0, col: 0 } }], pos: { line: 0, col: 0 } },
          }],
        },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      });
    }
  }

  private synthesizeEnum(info: ClassInfo) {
    info.fields = [
      { mods: ['private', 'final'], type: { name: 'String', dims: 0, pos: { line: 0, col: 0 } }, name: '__name', init: null, pos: { line: 0, col: 0 } },
      { mods: ['private', 'final'], type: { name: 'int', dims: 0, pos: { line: 0, col: 0 } }, name: '__ordinal', init: null, pos: { line: 0, col: 0 } },
      ...info.fields,
    ];
    info.methods.push(
      {
        mods: ['public'], name: 'name', ret: { name: 'String', dims: 0, pos: { line: 0, col: 0 } }, params: [],
        body: { t: 'block', pos: { line: 0, col: 0 }, body: [{ t: 'return', pos: { line: 0, col: 0 }, value: { t: 'field', target: { t: 'this', pos: { line: 0, col: 0 } }, name: '__name', pos: { line: 0, col: 0 } } }] },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      },
      {
        mods: ['public'], name: 'ordinal', ret: { name: 'int', dims: 0, pos: { line: 0, col: 0 } }, params: [],
        body: { t: 'block', pos: { line: 0, col: 0 }, body: [{ t: 'return', pos: { line: 0, col: 0 }, value: { t: 'field', target: { t: 'this', pos: { line: 0, col: 0 } }, name: '__ordinal', pos: { line: 0, col: 0 } } }] },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      },
      {
        mods: ['public'], name: 'toString', ret: { name: 'String', dims: 0, pos: { line: 0, col: 0 } }, params: [],
        body: { t: 'block', pos: { line: 0, col: 0 }, body: [{ t: 'return', pos: { line: 0, col: 0 }, value: { t: 'field', target: { t: 'this', pos: { line: 0, col: 0 } }, name: '__name', pos: { line: 0, col: 0 } } }] },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      },
      {
        mods: ['public', 'static'], name: 'values', ret: { name: info.name, dims: 1, pos: { line: 0, col: 0 } }, params: [],
        body: { t: 'block', pos: { line: 0, col: 0 }, body: [{ t: 'return', pos: { line: 0, col: 0 }, value: { t: 'name', name: '__enumValues', pos: { line: 0, col: 0 } } }] },
        throwsList: [], pos: { line: 0, col: 0 }, isCtor: false,
      },
    );
  }

  /* ── 実行 API ─────────────────────────────────────── */
  runMain(className: string, method = 'main') {
    const info = this.classes.get(className) ?? this.classes.get('Main');
    if (!info) throw new Error('実行できるクラスがありません');
    this.ensureStaticInit(info);
    const m = this.findMethod(className, method, 1);
    if (!m) {
      const m0 = this.findMethod(className, method, 0);
      if (!m0) throw new Error(`${className}.${method} が見つかりません`);
      this.invokeMethod(this.makeStaticContext(), m0, [], 0);
      return;
    }
    const args = newArr('String', []);
    this.invokeMethod(this.makeStaticContext(), m, [args], 0);
  }

  private staticCtx: JObj | null = null;
  private makeStaticContext(): JObj {
    if (!this.staticCtx) {
      this.staticCtx = newObj('__Static');
    }
    return this.staticCtx;
  }

  /* ── クラス・メソッド探索 ─────────────────────────── */
  findMethod(className: string, name: string, argc: number): MethodDecl | null {
    let cur: string | null = className;
    let guard = 0;
    while (cur && guard++ < 40) {
      const info = this.classes.get(cur);
      if (info) {
        const m = info.methods.find((mm) => mm.name === name && matchesArity(mm.params.length, argc, mm.params));
        if (m) return m;
        // interface の default メソッド
        for (const iface of info.interfaces) {
          const im = this.findMethod(iface, name, argc);
          if (im) return im;
        }
        cur = info.superName;
      } else {
        cur = BUILTIN_PARENT[cur] ?? null;
      }
    }
    return null;
  }

  findCtor(className: string, argc: number): MethodDecl | null {
    const info = this.classes.get(className);
    if (!info) return null;
    const c = info.ctors.find((cc) => matchesArity(cc.params.length, argc, cc.params));
    if (c) return c;
    if (info.ctors.length === 0 && argc === 0) return null;
    return null;
  }

  /**
   * 引数の値からオーバーロードを選ぶ。宣言順ではなく「最も特定的なもの」を選ぶ
   * （Java のメソッド解決の近似。プリミティブ拡張 < ボクシング < Object の順で優先）。
   */
  /** 式の静的な型（宣言型）。オーバーロード解決を Java と同じ規則に近づけるために使う。 */
  private staticTypeOf(e: Expr, scope: Scope): string | null {
    if (e.t === 'name') {
      let sc: Scope | null = scope;
      while (sc) {
        const t = sc.types.get(e.name);
        if (t) return t;
        sc = sc.parent;
      }
      return null;
    }
    if (e.t === 'cast') return e.type.name + '[]'.repeat(e.type.dims);
    if (e.t === 'new') return e.typeName;
    if (e.t === 'lit') {
      if (e.kind === 'string') return 'String';
      if (e.kind === 'char') return 'char';
      if (e.kind === 'boolean') return 'boolean';
      if (e.kind === 'double' || e.kind === 'float') return 'double';
      if (e.kind === 'long') return 'long';
      if (e.kind === 'null') return null;
      return 'int';
    }
    return null;
  }

  findMethodFor(className: string, name: string, args: JValue[], argTypes?: (string | null)[]): MethodDecl | null {
    let cur: string | null = className;
    let guard = 0;
    while (cur && guard++ < 40) {
      const info = this.classes.get(cur);
      if (info) {
        const cands = info.methods.filter((m) => m.name === name && matchesArity(m.params.length, args.length, m.params));
        if (cands.length) return this.mostSpecific(cands, args, argTypes);
        for (const iface of info.interfaces) {
          const im = this.findMethodFor(iface, name, args);
          if (im) return im;
        }
        cur = info.superName;
      } else {
        cur = BUILTIN_PARENT[cur] ?? null;
      }
    }
    return null;
  }

  private paramCost(v: JValue, typeName: string, staticType: string | null = null): number {
    if (v.k === 'null') return typeName === 'String' || typeName === 'Object' || !PRIM_NAMES.has(typeName) ? 6 : -1;
    if (v.k === 'pri') {
      if (typeName === v.t) return 0;
      const wide: Record<string, string[]> = {
        byte: ['short', 'int', 'long', 'float', 'double'],
        short: ['int', 'long', 'float', 'double'],
        char: ['int', 'long', 'float', 'double'],
        int: ['long', 'float', 'double'],
        long: ['float', 'double'],
        float: ['double'],
      };
      const idx = (wide[v.t] ?? []).indexOf(typeName);
      if (idx >= 0) return 1 + idx;
      const boxName: Record<string, string> = { int: 'Integer', long: 'Long', double: 'Double', float: 'Float', char: 'Character', boolean: 'Boolean', byte: 'Byte', short: 'Short' };
      if (typeName === boxName[v.t]) return 4;
      if (typeName === 'Object') return 8;
      return -1;
    }
    if (v.k === 'obj') {
      const declared = staticType ?? v.type;
      if (typeName === declared) return 0;
      if (typeName === v.type) return 1;
      if (this.isSubtype(declared, typeName)) return 2;
      if (typeName === 'Object') return 8;
      const primOf: Record<string, string> = { Integer: 'int', Long: 'long', Double: 'double', Float: 'float', Character: 'char', Boolean: 'boolean', Byte: 'byte', Short: 'short' };
      if (v.native?.kind === 'box' && primOf[v.type] && typeName === primOf[v.type]) return 3;
      return -1;
    }
    return -1;
  }

  private mostSpecific(cands: MethodDecl[], args: JValue[], argTypes?: (string | null)[]): MethodDecl {
    let best = cands[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const m of cands) {
      let score = 0;
      let ok = true;
      for (let i = 0; i < args.length; i++) {
        const c = this.paramCost(args[i], m.params[i].type.name, argTypes?.[i] ?? null);
        if (c < 0) {
          ok = false;
          break;
        }
        score += c;
      }
      if (ok && score < bestScore) {
        best = m;
        bestScore = score;
      }
    }
    return best;
  }

  isSubtype(a: string, b: string): boolean {
    if (a === b) return true;
    if (b === 'Object') return true;
    let cur: string | null = a;
    let guard = 0;
    while (cur && guard++ < 40) {
      const info = this.classes.get(cur);
      if (info) {
        if (info.superName === b) return true;
        if (info.interfaces.includes(b)) return true;
        for (const i of info.interfaces) if (this.isSubtype(i, b)) return true;
        cur = info.superName;
      } else {
        cur = BUILTIN_PARENT[cur] ?? null;
        if (cur === b) return true;
      }
    }
    return false;
  }

  /* ── フィールド ───────────────────────────────────── */
  private fieldOwner(className: string, field: string): { info: ClassInfo; decl: FieldDecl } | null {
    let cur: string | null = className;
    let guard = 0;
    while (cur && guard++ < 40) {
      const info = this.classes.get(cur);
      if (!info) return null;
      const d = info.fields.find((f) => f.name === field);
      if (d) return { info, decl: d };
      cur = info.superName;
    }
    return null;
  }

  private static fieldKey(owner: string, field: string) {
    return `${owner}#${field}`;
  }

  /** フィールドを書く。宣言したクラス名つきのキーと、素のキーの両方に書く。 */
  private writeField(obj: JObj, owner: string, field: string, value: JValue) {
    obj.fields.set(Interpreter.fieldKey(owner, field), value);
    obj.fields.set(field, value);
  }

  /**
   * フィールドを読む。静的な型が分かる場合はその型から見える宣言を優先する
   * （フィールドはメソッドと違い、隠蔽が静的な型で決まるため）。
   */
  private readField(obj: JObj, field: string, staticType: string | null = null): JValue {
    if (staticType) {
      const owner = this.fieldOwner(staticType, field);
      if (owner) {
        const v = obj.fields.get(Interpreter.fieldKey(owner.info.name, field));
        if (v !== undefined) return v;
      }
    }
    if (obj.fields.has(field)) return obj.fields.get(field)!;
    return jNull;
  }

  private ensureStaticInit(info: ClassInfo) {
    if (info.staticsReady) return;
    info.staticsReady = true;
    if (info.superName) {
      const sup = this.classes.get(info.superName);
      if (sup) this.ensureStaticInit(sup);
    }
    if (info.isEnum && info.decl) {
      // enum 定数の生成
      const values: JObj[] = [];
      info.decl.enumConstants.forEach((ec, idx) => {
        const obj = newObj(info.name);
        obj.fields.set('__name', newString(ec.name));
        obj.fields.set('__ordinal', I(idx));
        for (const f of info.fields) {
          if (f.name === '__name' || f.name === '__ordinal') continue;
          this.writeField(obj, info.name, f.name, jNull);
        }
        const scope = this.rootScope(obj, info.name, null);
        const ctor = info.ctors.find((c) => c.params.length === ec.args.length);
        if (ctor) this.invokeCtor(obj, info, ctor, ec.args.map((a) => this.eval(a, scope)), scope);
        values.push(obj);
        info.staticFields.set(ec.name, obj);
      });
      info.enumValues = values;
    }
    for (const f of info.fields) {
      if (!f.mods.includes('static')) continue;
      if (f.init && !info.staticFields.has(f.name)) {
        const scope = this.rootScope(null, info.name, null);
        info.staticFields.set(f.name, this.eval(f.init, scope));
      } else if (!info.staticFields.has(f.name)) {
        info.staticFields.set(f.name, defaultFor(f.type.name));
      }
    }
  }

  /* ── スコープ ─────────────────────────────────────── */
  private rootScope(thisObj: JObj | null, className: string, parent: Scope | null): Scope {
    const s: Scope = { vars: new Map(), types: new Map(), parent };
    if (thisObj) s.vars.set('__this', thisObj);
    s.vars.set('__class', newString(className));
    return s;
  }
  private thisOf(scope: Scope): JObj | null {
    let s: Scope | null = scope;
    while (s) {
      if (s.vars.has('__this')) return s.vars.get('__this') as JObj;
      s = s.parent;
    }
    return null;
  }
  private classOf(scope: Scope): string {
    let s: Scope | null = scope;
    while (s) {
      const c = s.vars.get('__class');
      if (c && c.k === 'obj' && c.native?.kind === 'string') return c.native.s;
      s = s.parent;
    }
    return 'Main';
  }
  private lookup(scope: Scope, name: string): JValue | undefined {
    let s: Scope | null = scope;
    while (s) {
      if (s.vars.has(name)) return s.vars.get(name);
      s = s.parent;
    }
    return undefined;
  }
  private declare(scope: Scope, name: string, value: JValue, type?: string) {
    scope.vars.set(name, value);
    if (type) scope.types.set(name, type);
  }
  private declaredType(scope: Scope, name: string): string | undefined {
    let s: Scope | null = scope;
    while (s) {
      if (s.types.has(name)) return s.types.get(name);
      s = s.parent;
    }
    return undefined;
  }

  private curLine(): number {
    return this.lineStack.length ? this.lineStack[this.lineStack.length - 1] : 0;
  }

  private tick(line: number) {
    this.stepCount++;
    if (this.stepCount > this.maxSteps) {
      this.truncated = true;
      throw makeException('StackOverflowError', `実行ステップが上限(${this.maxSteps})に達しました。無限ループの可能性があります。`, line);
    }
    this.lineStack.push(line);
  }
  private untick() {
    this.lineStack.pop();
  }

  /* ── 文の実行 ─────────────────────────────────────── */
  execBlock(body: Block | Stmt | Stmt[], scope: Scope) {
    const stmts = Array.isArray(body) ? body : (body as Block).body ?? [body as Stmt];
    const inner: Scope = { vars: new Map(), types: new Map(), parent: scope };
    for (const s of stmts) this.exec(s, inner);
  }

  exec(stmt: Stmt, scope: Scope): void {
    switch (stmt.t) {
      case 'var': {
        const v = stmt.init ? this.coerce(this.eval(stmt.init, scope), stmt.type) : defaultFor(stmt.type.name);
        this.declare(scope, stmt.name, v, stmt.type.dims > 0 ? stmt.type.name + '[]' : stmt.type.name);
        this.recordStep(stmt.pos.line, 'stmt', `${stmt.name} = ${short(v)}`, scope);
        return;
      }
      case 'expr':
        this.tick(stmt.pos.line);
        try {
          const before = stmt.expr;
          const v = this.eval(stmt.expr, scope);
          this.traceAssignment(before, v, stmt.pos.line, scope);
        } finally {
          this.untick();
        }
        return;
      case 'block':
        this.execBlock(stmt, scope);
        return;
      case 'if': {
        const test = this.eval(stmt.test, scope);
        if (truthy(test)) this.exec(stmt.then, scope);
        else if (stmt.other) this.exec(stmt.other, scope);
        return;
      }
      case 'while': {
        let round = 0;
        while (truthy(this.eval(stmt.test, scope))) {
          this.tick(stmt.pos.line);
          try {
            this.recordStep(stmt.pos.line, 'stmt', `while 本体 ${++round} 周目`, scope);
            this.exec(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal && !e.label) return;
            if (!(e instanceof ContinueSignal && !e.label)) throw e;
          } finally {
            this.untick();
          }
        }
        return;
      }
      case 'do': {
        for (;;) {
          try {
            this.exec(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal && !e.label) return;
            if (e instanceof ContinueSignal && !e.label) {
              /* fallthrough to test */
            } else throw e;
          }
          if (!truthy(this.eval(stmt.test, scope))) return;
        }
      }
      case 'for': {
        const inner: Scope = { vars: new Map(), types: new Map(), parent: scope };
        for (const init of stmt.init) this.exec(init, inner);
        let round = 0;
        for (;;) {
          if (stmt.test && !truthy(this.eval(stmt.test, inner))) return;
          this.tick(stmt.pos.line);
          try {
            this.recordStep(stmt.pos.line, 'stmt', `for 本体 ${++round} 周目`, inner);
            this.exec(stmt.body, inner);
          } catch (e) {
            if (e instanceof BreakSignal && !e.label) return;
            if (!(e instanceof ContinueSignal && !e.label)) throw e;
          } finally {
            this.untick();
          }
          for (const u of stmt.update) this.eval(u, inner);
        }
      }
      case 'foreach': {
        const iterable = this.eval(stmt.iter, scope);
        const items = this.iterate(iterable, stmt.pos.line);
        const modAtStart = modCounter(iterable);
        // for-each は Iterator を使う。ループ中に外から構造変更されると
        // ConcurrentModificationException（JDK と同じ挙動）にする。
        for (const item of items) {
          // 反復のたびに「構造が変わっていないか」を確かめる（Iterator の modCount 検査）
          if (modAtStart !== null) {
            const now = modCounter(iterable);
            if (now !== null && now !== modAtStart) {
              throw makeException('ConcurrentModificationException', 'for-each 中にコレクションが変更されました', stmt.pos.line);
            }
          }
          const inner: Scope = { vars: new Map(), types: new Map(), parent: scope };
          this.declare(inner, stmt.name, this.coerce(item, stmt.type));
          this.tick(stmt.pos.line);
          try {
            this.exec(stmt.body, inner);
          } catch (e) {
            if (e instanceof BreakSignal && !e.label) return;
            if (!(e instanceof ContinueSignal && !e.label)) throw e;
          } finally {
            this.untick();
          }
        }
        return;
      }
      case 'switch': {
        const subject = this.eval(stmt.subject, scope);
        let matched = false;
        let fellThrough = false;
        const inner: Scope = { vars: new Map(), types: new Map(), parent: scope };
        for (const c of stmt.cases) {
          const isDefault = c.labels === null;
          const match = isDefault ? false : c.labels!.some((l) => this.caseEquals(subject, this.eval(l, scope)));
          if (stmt.arrow) {
            if (match || (isDefault && !stmt.cases.some((cc) => cc.labels?.some((l) => this.caseEquals(subject, this.eval(l, scope)))))) {
              this.execBlock(c.body, inner);
              return;
            }
          } else {
            if (!matched && (match || (isDefault && !stmt.cases.some((cc) => cc.labels?.some((l) => this.caseEquals(subject, this.eval(l, scope))))))) {
              matched = true;
              fellThrough = true;
            }
            if (fellThrough) {
              try {
                this.execBlock(c.body, inner);
              } catch (e) {
                if (e instanceof BreakSignal && !e.label) return;
                if (e instanceof ReturnSignal) throw e;
                if (e instanceof ContinueSignal) throw e;
                if (e instanceof JavaThrow) throw e;
                throw e;
              }
            }
          }
        }
        return;
      }
      case 'break':
        throw new BreakSignal(stmt.label);
      case 'continue':
        throw new ContinueSignal(stmt.label);
      case 'return': {
        const v = stmt.value ? this.eval(stmt.value, scope) : jNull;
        this.recordStep(stmt.pos.line, 'return', `return ${short(v)}`, scope);
        throw new ReturnSignal(v);
      }
      case 'throw': {
        const v = this.eval(stmt.value, scope);
        if (v.k !== 'obj') {
          throw makeException('NullPointerException', 'throw に null は使えません', stmt.pos.line);
        }
        this.recordStep(stmt.pos.line, 'throw', `throw ${v.type}`, scope);
        throw new JavaThrow(v, stmt.pos.line);
      }
      case 'try': {
        let pending: unknown = null;
        let handled = false;
        try {
          this.execBlock(stmt.body, scope);
        } catch (e) {
          if (e instanceof JavaThrow) {
            for (const c of stmt.catches) {
              if (this.isSubtype(e.value.type, this.resolveTypeClassName(c.type.name))) {
                const inner: Scope = { vars: new Map(), types: new Map(), parent: scope };
                this.declare(inner, c.name, e.value);
                this.recordStep(c.pos.line, 'stmt', `catch ${e.value.type} ${c.name}`, scope);
                this.execBlock(c.body, inner);
                handled = true;
                break;
              }
            }
            if (!handled) pending = e;
          } else {
            pending = e;
          }
        } finally {
          if (stmt.fin) this.execBlock(stmt.fin, scope);
        }
        if (pending) throw pending;
        return;
      }
      case 'labeled': {
        try {
          this.exec(stmt.body, scope);
        } catch (e) {
          if (e instanceof BreakSignal && e.label === stmt.label) return;
          if (e instanceof ContinueSignal && e.label === stmt.label) return;
          throw e;
        }
        return;
      }
      case 'empty':
        return;
    }
  }

  private caseEquals(subject: JValue, label: JValue): boolean {
    if (subject.k === 'pri' && label.k === 'pri') return toNumber(subject) === toNumber(label);
    if (subject.k === 'obj' && label.k === 'obj') return equalsJava(subject, label);
    return false;
  }

  private iterate(v: JValue, line: number): JValue[] {
    if (v.k === 'arr') return v.items;
    if (v.k === 'obj') {
      const n = v.native;
      if (n?.kind === 'list') return n.items;
      if (n?.kind === 'set') return n.items;
      if (n?.kind === 'iterator') return n.items;
    }
    if (v.k === 'null') throw makeException('NullPointerException', 'for-each の対象が null です', line);
    throw makeException('UnsupportedOperationException', 'この値は for-each できません', line);
  }

  /* ── 式の評価 ─────────────────────────────────────── */
  eval(expr: Expr, scope: Scope): JValue {
    switch (expr.t) {
      case 'lit':
        return literalValue(expr.kind, expr.value);
      case 'this': {
        const t = this.thisOf(scope);
        if (!t) throw makeException('RuntimeException', 'this はインスタンスメソッドの中でだけ使えます', expr.pos.line);
        return t;
      }
      case 'super': {
        const t = this.thisOf(scope);
        if (!t) throw makeException('RuntimeException', 'super はインスタンスメソッドの中でだけ使えます', expr.pos.line);
        return t;
      }
      case 'name': {
        const found = this.lookup(scope, expr.name);
        if (found !== undefined) return found;
        const cls0 = this.classOf(scope);
        const sfDecl = this.staticFieldDecl(cls0, expr.name);
        if (sfDecl && sfDecl.mods.includes('static')) {
          const stat0 = this.staticField(cls0, expr.name);
          if (stat0 !== undefined) return stat0;
        }
        const t = this.thisOf(scope);
        if (t) {
          const f = this.fieldOwner(t.type, expr.name);
          if (f) return this.readField(t, expr.name);
        }
        const cls = this.classOf(scope);
        const stat = this.staticField(cls, expr.name);
        if (stat !== undefined) return stat;
        if (this.classes.has(expr.name) || BUILTIN_PARENT[expr.name] !== undefined) {
          return { k: 'class', name: expr.name };
        }
        throw makeException('RuntimeException', `変数 ${expr.name} が見つかりません`, expr.pos.line);
      }
      case 'field': {
        if (expr.target.t === 'name' && expr.target.name === 'System' && (expr.name === 'out' || expr.name === 'err')) {
          return newObj('PrintStream', { kind: 'printstream', err: expr.name === 'err' });
        }
        // Enum 定数・static フィールド・Class 参照
        if (expr.target.t === 'name') {
          const maybeClass = this.classes.has(expr.target.name) ? expr.target.name : null;
          if (maybeClass) {
            const info = this.classes.get(maybeClass)!;
            this.ensureStaticInit(info);
            const sv = this.staticField(maybeClass, expr.name);
            if (sv !== undefined) return sv;
            const t = this.thisOf(scope);
            if (t) {
              const f = this.fieldOwner(t.type, expr.name);
              if (f) return this.readField(t, expr.name);
            }
            throw makeException('RuntimeException', `${maybeClass}.${expr.name} が見つかりません`, expr.pos.line);
          }
        }
        const target = this.eval(expr.target, scope);
        if (target.k === 'class') {
          const sv = this.staticConst(target.name, expr.name);
          if (sv !== undefined) return sv;
          throw makeException('RuntimeException', `${target.name}.${expr.name} が見つかりません`, expr.pos.line);
        }
        if (target.k === 'arr') {
          if (expr.name === 'length') return I(target.items.length);
          throw makeException('RuntimeException', `配列に ${expr.name} はありません`, expr.pos.line);
        }
        if (target.k === 'null') throw makeException('NullPointerException', `Cannot read field "${expr.name}" because the value is null`, expr.pos.line);
        if (target.k === 'obj') {
          if (target.native?.kind === 'string' && expr.name === 'CASE_INSENSITIVE_ORDER') return { k: 'class', name: 'Comparator' };
        return this.readField(target, expr.name, this.staticTypeOf(expr.target, scope));
        }
        throw makeException('RuntimeException', `フィールド ${expr.name} を読めません`, expr.pos.line);
      }
      case 'index': {
        const target = this.eval(expr.target, scope);
        const idx = this.eval(expr.index, scope);
        const i = toNumber(idx) | 0;
        if (target.k === 'null') throw makeException('NullPointerException', '配列が null です', expr.pos.line);
        if (target.k !== 'arr') throw makeException('RuntimeException', '配列以外に [] は使えません', expr.pos.line);
        if (i < 0 || i >= target.items.length) {
          throw makeException('ArrayIndexOutOfBoundsException', `Index ${i} out of bounds for length ${target.items.length}`, expr.pos.line);
        }
        return target.items[i];
      }
      case 'call':
        return this.evalCall(expr, scope);
      case 'new':
        return this.evalNew(expr, scope);
      case 'unary': {
        const v = this.eval(expr.expr, scope);
        if (expr.op === '!') return truthy(v) ? FALSE_() : TRUE_();
        if (expr.op === '+') return this.numericPromote(v);
        if (expr.op === '-') {
          const p = this.numericPromote(v);
          return negate(p);
        }
        if (expr.op === '~') {
          const p = this.numericPromote(v);
          if (p.t === 'long') return pri('long', ~(p.v as bigint));
          return I(~toNumber(p));
        }
        throw makeException('RuntimeException', `未知の単項演算子 ${expr.op}`, expr.pos.line);
      }
      case 'prefix':
      case 'postfix': {
        const old = this.eval(expr.expr, scope);
        const updated = this.addNumeric(old, I(1), expr.op === '++' ? '+' : '-', expr.pos.line);
        this.assignTo(expr.expr, updated, scope, expr.pos.line);
        return expr.t === 'prefix' ? updated : old;
      }
      case 'binary': {
        const left = this.eval(expr.left, scope);
        // && と || は短絡
        if (expr.op === '&&') {
          if (!truthy(left)) return FALSE_();
          return truthy(this.eval(expr.right, scope)) ? TRUE_() : FALSE_();
        }
        if (expr.op === '||') {
          if (truthy(left)) return TRUE_();
          return truthy(this.eval(expr.right, scope)) ? TRUE_() : FALSE_();
        }
        const right = this.eval(expr.right, scope);
        return this.binaryOp(expr.op, left, right, expr.pos.line);
      }
      case 'assign': {
        if (expr.op === '=') {
          const v = this.eval(expr.value, scope);
          this.assignTo(expr.target, v, scope, expr.pos.line);
          return v;
        }
        const cur = this.eval(expr.target, scope);
        const rhs = this.eval(expr.value, scope);
        const op = expr.op.slice(0, -1);
        const result = this.binaryOp(op, cur, rhs, expr.pos.line);
        const declType = expr.target.t === 'name' ? this.declaredType(scope, expr.target.name) : undefined;
        const coerced = declType ? this.coerce(result, { name: declType, dims: 0, pos: expr.pos }) : result;
        this.assignTo(expr.target, coerced, scope, expr.pos.line);
        return coerced;
      }
      case 'cond': {
        return truthy(this.eval(expr.test, scope)) ? this.eval(expr.then, scope) : this.eval(expr.other, scope);
      }
      case 'cast': {
        const v = this.eval(expr.expr, scope);
        return this.castTo(expr.type, v, expr.pos.line);
      }
      case 'instanceof': {
        const v = this.eval(expr.expr, scope);
        if (v.k === 'null') return FALSE_();
        const tname = this.resolveTypeClassName(expr.type.name);
        if (v.k === 'arr') return expr.type.dims > 0 ? TRUE_() : FALSE_();
        if (v.k === 'pri') {
          const map: Record<string, string> = { Integer: 'int', Double: 'double', Long: 'long', Boolean: 'boolean', Character: 'char', Float: 'float' };
          return map[tname] === v.t ? TRUE_() : FALSE_();
        }
        if (v.k !== 'obj') return FALSE_();
        return this.isSubtype(v.type, tname) ? TRUE_() : FALSE_();
      }
      case 'lambda': {
        const captured: Scope = { vars: new Map(), types: new Map(), parent: null };
        let s: Scope | null = scope;
        while (s) {
          for (const [k, v] of s.vars) if (!k.startsWith('__')) captured.vars.set(k, v);
          s = s.parent;
        }
        const fn = newObj('Function', {
          kind: 'fn', params: expr.params, body: { node: expr.body, scope: captured, self: this },
          env: captured, kindOf: 'lambda',
        });
        return fn;
      }
      case 'methodref': {
        // 式::メソッド は、その時点の受け手を捕まえる（System.out::println など）
        const recv = expr.receiver ? this.eval(expr.receiver, scope) : null;
        return newObj('Function', {
          kind: 'fn', params: [], body: { methodrefOwner: expr.owner, methodrefName: expr.name, receiver: recv, self: this },
          env: null, kindOf: 'methodref',
        });
      }
    }
  }

  /** `java.util.Arrays` のような修飾名を文字列に戻す（静的呼び出しの解決用）。 */
  private dottedName(e: Expr): string | null {
    if (e.t === 'name') return e.name;
    if (e.t === 'field') {
      const left = this.dottedName(e.target);
      return left ? left + '.' + e.name : null;
    }
    return null;
  }

  private evalCall(expr: Extract<Expr, { t: 'call' }>, scope: Scope): JValue {
    // コンストラクタ委譲 this(...) / super(...)
    if (expr.target?.t === 'this' && expr.name === 'this') {
      const t = this.thisOf(scope);
      if (!t) throw makeException('RuntimeException', 'this() はコンストラクタ内でのみ使えます', expr.pos.line);
      const args = expr.args.map((a) => this.eval(a, scope));
      // B のインスタンスでも、A のコンストラクタ内の this(...) は A の他のコンストラクタを呼ぶ
      const owner = this.ctorStack[this.ctorStack.length - 1] ?? t.type;
      this.callCtorOnExisting(t, args, expr.pos.line, owner);
      return jNull;
    }
    if (expr.target?.t === 'super') {
      if (expr.name === 'super') {
        const t = this.thisOf(scope);
        if (!t) throw makeException('RuntimeException', 'super() はコンストラクタ内でのみ使えます', expr.pos.line);
        const args = expr.args.map((a) => this.eval(a, scope));
        const sup = this.classes.get(t.type)?.superName ?? 'Object';
        this.callSuperCtor(t, sup, args, expr.pos.line);
        return jNull;
      }
      const t = this.thisOf(scope);
      if (!t) throw makeException('RuntimeException', 'super はインスタンス内でのみ使えます', expr.pos.line);
      const args = expr.args.map((a) => this.eval(a, scope));
      const sup = this.classes.get(t.type)?.superName ?? null;
      if (!sup) throw makeException('RuntimeException', '親クラスがありません', expr.pos.line);
      return this.invokeUserOrNative(t, sup, expr.name, args, expr.pos.line, true);
    }

    if (!expr.target && (expr.name === '__recordToString' || expr.name === '__recordEquals')) {
      const self = this.thisOf(scope);
      if (!self) throw makeException('RuntimeException', 'record の外では使えません', expr.pos.line);
      const info = this.classes.get(self.type);
      const comps = info?.decl?.recordComponents ?? [];
      if (expr.name === '__recordToString') {
        const body = comps.map((c) => `${c.name}=${toStringJava(self.fields.get(Interpreter.fieldKey(self.type, c.name)) ?? self.fields.get(c.name) ?? jNull)}`).join(', ');
        return newString(`${self.type}[${body}]`);
      }
      const other = this.eval(expr.args[0], scope);
      if (other.k !== 'obj' || other.type !== self.type) return FALSE_();
      return comps.every((c) =>
        equalsJava(
          self.fields.get(Interpreter.fieldKey(self.type, c.name)) ?? self.fields.get(c.name) ?? jNull,
          other.fields.get(Interpreter.fieldKey(other.type, c.name)) ?? other.fields.get(c.name) ?? jNull,
        ),
      )
        ? TRUE_()
        : FALSE_();
    }

    // 静的呼び出し or インスタンス呼び出し
    if (!expr.target) {
      // 同一クラス内のメソッド
      const args = expr.args.map((a) => this.eval(a, scope));
      const cls = this.classOf(scope);
      const self = this.thisOf(scope);
      const argTypes = expr.args.map((a) => this.staticTypeOf(a, scope));
      if (self) {
        const m = this.findMethodFor(self.type, expr.name, args, argTypes);
        if (m) return this.invokeMethod(self, m, args, expr.pos.line);
      }
      const m2 = this.findMethodFor(cls, expr.name, args, argTypes);
      if (m2) return this.invokeMethod(self ?? this.makeStaticContext(), m2, args, expr.pos.line);
      throw makeException('RuntimeException', `メソッド ${expr.name} が見つかりません`, expr.pos.line);
    }

    // 修飾名による静的呼び出し（java.util.Arrays.sort など）
    const dotted = expr.target ? this.dottedName(expr.target) : null;
    if (dotted) {
      const last = dotted.slice(dotted.lastIndexOf('.') + 1);
      if ((this.classes.has(last) || BUILTIN_PARENT[last] !== undefined) && !this.lookup(scope, dotted.split('.')[0])) {
        const args = expr.args.map((a) => this.eval(a, scope));
        return this.invokeStatic(last, expr.name, args, expr.pos.line);
      }
    }

    // Class 参照か
    if (expr.target.t === 'name') {
      const n = expr.target.name;
      if (this.classes.has(n) || BUILTIN_STATIC.has(n)) {
        if (!this.lookup(scope, n)) {
          const args = expr.args.map((a) => this.eval(a, scope));
          return this.invokeStatic(n, expr.name, args, expr.pos.line);
        }
      }
      // 変数として存在するならインスタンス呼び出し
    }

    const recv = this.eval(expr.target, scope);
    if (recv.k === 'class') {
      const args = expr.args.map((a) => this.eval(a, scope));
      return this.invokeStatic(recv.name, expr.name, args, expr.pos.line);
    }
    const args = expr.args.map((a) => this.eval(a, scope));
    // 静的メソッドはインスタンス経由でも静的な型で解決される（Java の規則）
    const stype = this.staticTypeOf(expr.target, scope);
    if (stype && this.classes.has(stype)) {
      const sm = this.findMethodFor(stype, expr.name, []);
      if (sm && sm.mods.includes('static')) return this.invokeStatic(stype, expr.name, args, expr.pos.line);
    }
    return this.invokeInstance(recv, expr.name, args, expr.pos.line);
  }

  private evalNew(expr: Extract<Expr, { t: 'new' }>, scope: Scope): JValue {
    const typeName = this.resolveTypeClassName(expr.typeName);
    const pos = expr.pos.line;

    if (expr.arrayDims) {
      const dim = expr.arrayDims[0];
      const n = dim ? toNumber(this.eval(dim, scope)) | 0 : 0;
      if (n < 0) throw makeException('NegativeArraySizeException', String(n), pos);
      const items: JValue[] = [];
      if (expr.arrayDims.length > 1) {
        for (let i = 0; i < n; i++) {
          const inner = this.evalNew({ ...expr, arrayDims: expr.arrayDims.slice(1) }, scope);
          items.push(inner.k === 'arr' ? newArr(inner.elemType, [...inner.items]) : inner);
        }
      } else {
        for (let i = 0; i < n; i++) items.push(defaultFor(typeName));
      }
      this.recordStep(pos, 'alloc', `new ${typeName}[${n}]`, scope);
      return newArr(typeName, items);
    }
    if (expr.arrayInit) {
      const depth = expr.initDims ?? 1;
      if (depth > 1) {
        // `{{1, 2}, {3}}` のような多次元の初期化子。各要素はすでに配列。
        const rows = expr.arrayInit.map((e) => this.eval(e, scope));
        return newArr(typeName, rows);
      }
      const items = expr.arrayInit.map((e) => this.coerce(this.eval(e, scope), { name: typeName, dims: 0, pos: expr.pos }));
      return newArr(typeName, items);
    }

    const args = expr.args.map((a) => this.eval(a, scope));

    // 標準ライブラリのコンストラクタ
    switch (typeName) {
      case 'String': {
        if (args.length === 0) return newString('');
        if (args[0].k === 'arr') return newString(args[0].items.map((x) => display(x)).join(''));
        return newString(display(args[0]));
      }
      case 'ArrayList':
      case 'LinkedList':
        return newObj('ArrayList', { kind: 'list', items: args[0] && args[0].k === 'obj' && args[0].native?.kind === 'list' ? [...args[0].native.items] : [] });
      case 'HashSet':
      case 'LinkedHashSet':
        return newObj('HashSet', { kind: 'set', items: [] });
      case 'HashMap':
      case 'TreeMap':
      case 'LinkedHashMap':
        return newObj('HashMap', { kind: 'map', entries: [] });
      case 'StringBuilder':
      case 'StringBuffer': {
        if (args.length === 0) return newObj('StringBuilder', { kind: 'builder', s: '' });
        return newObj('StringBuilder', { kind: 'builder', s: args[0].k === 'null' ? 'null' : display(args[0]) });
      }
      case 'RuntimeException':
      case 'Exception':
      case 'IllegalArgumentException':
      case 'IllegalStateException':
      case 'ArrayIndexOutOfBoundsException':
      case 'UnsupportedOperationException':
      case 'NoSuchElementException':
      case 'IOException': {
        const msg = args.length ? display(args[0]) : null;
        return newObj(typeName, { kind: 'throwable', message: msg, checked: ['Exception', 'IOException'].includes(typeName), stack: [] });
      }
      case 'Object':
        return newObj('Object');
      default:
        break;
    }

    const info = this.classes.get(typeName);
    if (!info) {
      if (BUILTIN_PARENT[typeName] !== undefined) return newObj(typeName);
      throw makeException('RuntimeException', `クラス ${typeName} が見つかりません`, pos);
    }
    if (info.isInterface || info.isAbstract) {
      throw makeException('RuntimeException', `abstract な型 ${typeName} は new できません`, pos);
    }
    const obj = newObj(typeName);
    this.recordStep(pos, 'alloc', `new ${typeName}`, scope);
    // JLS の手順: 全フィールドを既定値で確保 → コンストラクタ。
    // 各クラスのフィールド初期化子は、そのクラスの super() が戻った直後に走る。
    this.initDefaultFields(obj, typeName);
    const ctor = info.ctors.find((c) => matchesArity(c.params.length, args.length, c.params));
    if (ctor) {
      this.invokeCtor(obj, info, ctor, args, this.rootScope(obj, typeName, scope.parent));
    } else if (args.length > 0) {
      throw makeException('RuntimeException', `${typeName}(${args.length} 引数) のコンストラクタがありません`, pos);
    } else {
      // 明示的なコンストラクタが無い場合の既定コンストラクタ
      this.runDefaultCtor(obj, info);
    }
    return obj;
  }

  /** 階層全体のフィールドを既定値で確保する（JLS 12.5 の手順 1〜3） */
  private initDefaultFields(obj: JObj, typeName: string) {
    const chain: ClassInfo[] = [];
    let cur: string | null = typeName;
    let guard = 0;
    while (cur && guard++ < 30) {
      const info = this.classes.get(cur);
      if (!info) break;
      chain.unshift(info);
      cur = info.superName;
    }
    for (const info of chain) {
      for (const f of info.fields) {
        if (f.mods.includes('static') || f.name === '__name' || f.name === '__ordinal') continue;
        this.writeField(obj, info.name, f.name, defaultFor(f.type.name));
      }
    }
  }

  /** そのクラスで宣言されたインスタンスフィールドの初期化子を実行する */
  private initFieldsOf(obj: JObj, info: ClassInfo, outer: Scope) {
    for (const f of info.fields) {
      if (f.mods.includes('static') || f.name === '__name' || f.name === '__ordinal') continue;
      const initScope = this.rootScope(obj, info.name, outer.parent);
      this.writeField(obj, info.name, f.name, f.init ? this.eval(f.init, initScope) : defaultFor(f.type.name));
    }
  }

  /** 明示的な super() が無いときの暗黙の super() */
  private invokeImplicitSuper(obj: JObj, info: ClassInfo) {
    const supName = info.superName;
    if (!supName) return;
    const sup = this.classes.get(supName);
    if (!sup) return; // Object など JDK 側の親
    const ctor = sup.ctors.find((c) => matchesArity(c.params.length, 0, c.params));
    if (ctor) this.invokeCtor(obj, sup, ctor, [], this.rootScope(obj, supName, null));
    else this.runDefaultCtor(obj, sup);
  }

  /** コンストラクタを書いていないクラスの既定コンストラクタ */
  private runDefaultCtor(obj: JObj, info: ClassInfo) {
    this.invokeImplicitSuper(obj, info);
    const outer = this.rootScope(obj, info.name, null);
    this.methodStack.push(`${info.name}()`);
    try {
      this.initFieldsOf(obj, info, outer);
    } finally {
      this.methodStack.pop();
    }
  }

  private delegationOf(stmt: Stmt | undefined): 'this' | 'super' | null {
    if (!stmt || stmt.t !== 'expr') return null;
    const e = stmt.expr;
    if (e.t !== 'call') return null;
    if (e.name === 'this' && e.target?.t === 'this') return 'this';
    if (e.name === 'super' && e.target?.t === 'super') return 'super';
    return null;
  }

  private invokeCtor(obj: JObj, info: ClassInfo, ctor: MethodDecl, args: JValue[], outer: Scope) {
    const scope = this.rootScope(obj, info.name, outer.parent);
    ctor.params.forEach((p, i) => this.declare(scope, p.name, this.coerce(args[i] ?? defaultFor(p.type.name), p.type)));
    this.methodStack.push(`${info.name}()`);
    this.ctorStack.push(info.name);
    try {
      const stmts: Stmt[] = ctor.body ? (ctor.body.t === 'block' ? ctor.body.body : [ctor.body]) : [];
      let i = 0;
      const delegation = this.delegationOf(stmts[0]);
      if (delegation) {
        // 明示的な this(...) / super(...)。super() が戻った直後にこのクラスの初期化子。
        this.execBlock(stmts[0], scope);
        i = 1;
        if (delegation === 'super') this.initFieldsOf(obj, info, scope);
      } else {
        this.invokeImplicitSuper(obj, info);
        this.initFieldsOf(obj, info, scope);
      }
      for (; i < stmts.length; i++) this.execBlock(stmts[i], scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return;
      throw e;
    } finally {
      this.methodStack.pop();
      this.ctorStack.pop();
    }
  }

  private callCtorOnExisting(obj: JObj, args: JValue[], line: number, owner?: string) {
    const info = this.classes.get(owner ?? obj.type);
    if (!info) return;
    const ctor = info.ctors.find((c) => matchesArity(c.params.length, args.length, c.params));
    if (ctor) this.invokeCtor(obj, info, ctor, args, this.rootScope(obj, info.name, null));
    void line;
  }

  private callSuperCtor(obj: JObj, superName: string, args: JValue[], line: number) {
    const info = this.classes.get(superName);
    if (!info) return;
    const ctor = info.ctors.find((c) => matchesArity(c.params.length, args.length, c.params));
    if (ctor) this.invokeCtor(obj, info, ctor, args, this.rootScope(obj, superName, null));
    void line;
  }

  /* ── 呼び出し ─────────────────────────────────────── */
  invokeStatic(className: string, name: string, args: JValue[], line: number): JValue {
    const info = this.classes.get(className);
    if (info) {
      this.ensureStaticInit(info);
      if (info.isEnum && name === 'values') return newArr(className, info.enumValues ?? []);
      if (info.isEnum && name === 'valueOf') {
        const wanted = args[0]?.k === 'obj' ? toStringJava(args[0]) : display(args[0]);
        const hit = (info.enumValues ?? []).find(
          (v) => v.k === 'obj' && toStringJava(v.fields.get(Interpreter.fieldKey(v.type, '__name')) ?? v.fields.get('__name') ?? jNull) === wanted,
        );
        if (!hit) throw makeException('IllegalArgumentException', `${className} に ${wanted} という定数はありません`, line);
        return hit;
      }
      if (info.isEnum && name === '__enumValues') return newArr(className, info.enumValues ?? []);
      const m = this.findMethodFor(className, name, args);
      if (m) return this.invokeMethod(this.makeStaticContext(), m, args, line);
    }
    const r = callStatic(className, name, args, this.helpers);
    if (r !== NOT_NATIVE) return r;
    throw makeException('RuntimeException', `${className}.${name}() は未対応です`, line);
  }

  invokeInstance(recv: JValue, name: string, args: JValue[], line: number): JValue {
    if (recv.k === 'null') {
      throw makeException('NullPointerException', `Cannot invoke "${name}()" because the value is null`, line);
    }
    if (recv.k === 'arr') {
      // 配列の要素数は length フィールド。length() ではない（String の length() と混同しやすい）
      if (name === 'length' && args.length === 0) {
        throw makeException('RuntimeException', 'cannot find symbol: method length()', line);
      }
      if (name === 'toString') return newString('[array');
      if (name === 'clone') return newArr(recv.elemType, [...recv.items]);
    }
    if (recv.k === 'obj' && recv.native?.kind === 'printstream') {
      switch (name) {
        case 'println':
          this.write(args.length ? this.toStringDispatch(args[0]) : '', true);
          return jNull;
        case 'print':
          this.write(args.length ? this.toStringDispatch(args[0]) : '', false);
          return jNull;
        case 'printf':
        case 'format': {
          const text = formatJava(stringOf(args[0]), args.slice(1), this.helpers);
          this.write(text, false);
          return jNull;
        }
        case 'flush':
          return jNull;
        default:
          throw makeException('RuntimeException', `PrintStream.${name}() は未対応です`, line);
      }
    }
    if (recv.k === 'obj') {
      const m = this.findMethodFor(recv.type, name, args);
      if (m) return this.invokeMethod(recv, m, args, line);
      const r = callMethod(recv, name, args, this.helpers);
      if (r !== NOT_NATIVE) return r;
      // 継承チェーン側にメソッドがあるか
      const m2 = this.findMethodInChain(recv.type, name, args.length);
      if (m2) return this.invokeMethod(recv, m2, args, line);
      throw makeException('RuntimeException', `${recv.type} に ${name}() はありません`, line);
    }
    if (recv.k === 'pri') {
      if (name === 'toString') return newString(display(recv));
    }
    throw makeException('RuntimeException', `${name}() を呼べません`, line);
  }

  private findMethodInChain(type: string, name: string, argc: number): MethodDecl | null {
    return this.findMethod(type, name, argc);
  }

  private invokeUserOrNative(recv: JObj, startClass: string, name: string, args: JValue[], line: number, _super: boolean): JValue {
    const m = this.findMethodFor(startClass, name, args);
    if (m) return this.invokeMethod(recv, m, args, line);
    const r = callMethod(recv, name, args, this.helpers);
    if (r !== NOT_NATIVE) return r;
    throw makeException('RuntimeException', `${startClass} に ${name}() はありません`, line);
  }

  invokeMethod(self: JObj, m: MethodDecl, args: JValue[], line: number): JValue {
    if (this.depth > 200) {
      throw makeException('StackOverflowError', 'メソッド呼び出しが深すぎます', line);
    }
    const owner = this.classOfFromMethod(m);
    const scope = this.rootScope(m.mods.includes('static') ? null : self, owner, null);
    // varargs
    if (m.params.length && m.params[m.params.length - 1].varargs) {
      const fixed = m.params.length - 1;
      m.params.forEach((p, i) => {
        if (i < fixed) this.declare(scope, p.name, this.coerce(args[i] ?? defaultFor(p.type.name), p.type));
      });
      const rest = args.slice(fixed);
      this.declare(scope, m.params[fixed].name, newArr(m.params[fixed].type.name, rest.map((r) => this.coerce(r, m.params[fixed].type))));
    } else {
      m.params.forEach((p, i) => this.declare(scope, p.name, this.coerce(args[i] ?? defaultFor(p.type.name), p.type)));
    }
    if (!m.body) throw makeException('RuntimeException', `${m.name} は abstract メソッドです`, line);

    this.depth++;
    this.methodStack.push(`${owner}.${m.name}`);
    this.recordStep(m.pos.line, 'call', `${owner}.${m.name}(${m.params.map((p) => p.name).join(', ')})`, scope);
    try {
      this.execBlock(m.body, scope);
      return jNull;
    } catch (e) {
      // 宣言された戻り値の型へ変換する（int の式を double で返すと 1.0 になる）
      if (e instanceof ReturnSignal) return this.coerceToReturn(e.value, m.ret);
      throw e;
    } finally {
      this.depth--;
      this.methodStack.pop();
    }
  }

  /** return の値を、メソッド宣言の戻り値型へ変換する（JLS 5.2 の代入変換） */
  private coerceToReturn(v: JValue, ret: TypeRef): JValue {
    const name = this.resolveTypeClassName(ret.name);
    if (ret.dims > 0) return v;
    if (name === 'void') return v;
    if (v.k === 'pri' || (v.k === 'obj' && v.native?.kind === 'box')) return this.coerce(v, ret);
    return v;
  }

  private classOfFromMethod(m: MethodDecl): string {
    for (const info of this.classes.values()) {
      if (info.methods.includes(m)) return info.name;
    }
    return 'Main';
  }

  /* ── 関数値（lambda / method ref / Comparator） ────── */
  callFunctionValue(fn: JValue, args: JValue[], line: number): JValue {
    if (fn.k !== 'obj' || fn.native?.kind !== 'fn') {
      throw makeException('RuntimeException', '関数ではありません', line);
    }
    const nat = fn.native;
    const body = nat.body as any;
    if (body?.methodrefName) {
      const owner = body.methodrefOwner;
      const name = body.methodrefName;
      const recv = body.receiver as JValue | null;
      if (owner === '<expr>') {
        if (!recv) throw makeException('RuntimeException', 'この参照は未対応です', line);
        return this.invokeInstance(recv, name, args, line);
      }
      if (this.classes.has(owner)) {
        const m = this.findMethod(owner, name, args.length);
        if (m) return this.invokeMethod(m.mods.includes('static') ? this.makeStaticContext() : args[0] as JObj, m, m.mods.includes('static') ? args : args.slice(1), line);
      }
      if (name === 'length' && args[0]?.k === 'obj' && args[0].type === 'String') {
        return this.invokeInstance(args[0], 'length', [], line);
      }
      if (name === 'toUpperCase' || name === 'toLowerCase' || name === 'trim') {
        return this.invokeInstance(args[0], name, [], line);
      }
      if (name === 'valueOf') return newString(display(args[0]));
      if (name === 'println') {
        this.write(display(args[0]), true);
        return jNull;
      }
      return this.invokeInstance(args[0], name, args.slice(1), line);
    }
    if (body?.kind === 'comparing') {
      const k1 = this.callFunctionValue(body.keyFn, [args[0]], line);
      const k2 = this.callFunctionValue(body.keyFn, [args[1]], line);
      if (k1.k === 'obj' && k2.k === 'obj' && k1.type === 'String' && k2.type === 'String') {
        const a = display(k1), b = display(k2);
        return I(a < b ? -1 : a > b ? 1 : 0);
      }
      return I(Math.sign(toNumber(k1) - toNumber(k2)));
    }
    if (body?.kind === 'natural') {
      const a = display(args[0]), b = display(args[1]);
      return I(a < b ? -1 : a > b ? 1 : 0);
    }
    if (body?.kind === 'chain') {
      const mid = this.callFunctionValue(body.first, args, line);
      return this.callFunctionValue(body.second, [mid], line);
    }

    const node = body?.node as Stmt | Expr | undefined;
    const parentScope = body?.scope as Scope | undefined;
    if (!node) throw makeException('RuntimeException', '関数本体がありません', line);
    const scope: Scope = { vars: new Map(), types: new Map(), parent: parentScope ?? null };
    nat.params.forEach((p, i) => this.declare(scope, p, args[i] ?? jNull));
    if (node && (node as Stmt).t && ['var', 'expr', 'block', 'if', 'return', 'while', 'for', 'foreach', 'switch', 'try', 'throw', 'break', 'continue', 'do', 'labeled', 'empty'].includes((node as Stmt).t)) {
      try {
        this.exec(node as Stmt, scope);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
      return jNull;
    }
    return this.eval(node as Expr, scope);
  }

  /* ── 代入 ─────────────────────────────────────────── */
  private assignTo(target: Expr, value: JValue, scope: Scope, line: number) {
    switch (target.t) {
      case 'name': {
        let s: Scope | null = scope;
        while (s) {
          if (s.vars.has(target.name)) {
            s.vars.set(target.name, value);
            return;
          }
          s = s.parent;
        }
        const clsName = this.classOf(scope);
        const sfDecl0 = this.staticFieldDecl(clsName, target.name);
        if (sfDecl0 && sfDecl0.mods.includes('static')) {
          const info0 = this.classes.get(clsName);
          if (info0) {
            this.ensureStaticInit(info0);
            info0.staticFields.set(target.name, this.coerce(value, sfDecl0.type));
            return;
          }
        }
        const t = this.thisOf(scope);
        if (t) {
          const f = this.fieldOwner(t.type, target.name);
          if (f) {
            this.writeField(t, f.info.name, target.name, this.coerce(value, f.decl.type));
            return;
          }
        }
        const cls = this.classOf(scope);
        const info = this.classes.get(cls);
        if (info) {
          const sf = this.staticFieldDecl(cls, target.name);
          if (sf) {
            info.staticFields.set(target.name, this.coerce(value, sf.type));
            return;
          }
        }
        throw makeException('RuntimeException', `変数 ${target.name} に代入できません`, line);
      }
      case 'field': {
        if (target.target.t === 'name' && this.classes.has(target.target.name) && !this.lookup(scope, target.target.name)) {
          const info = this.classes.get(target.target.name)!;
          this.ensureStaticInit(info);
          const sf = this.staticFieldDecl(target.target.name, target.name);
          if (sf) {
            info.staticFields.set(target.name, this.coerce(value, sf.type));
            return;
          }
          throw makeException('RuntimeException', `${target.target.name}.${target.name} に代入できません`, line);
        }
        const obj = this.eval(target.target, scope);
        if (obj.k === 'null') throw makeException('NullPointerException', `Cannot assign field "${target.name}" because the value is null`, line);
        if (obj.k === 'class') {
          const info = this.classes.get(obj.name);
          if (info) {
            const sf = this.staticFieldDecl(obj.name, target.name);
            if (sf) {
              info.staticFields.set(target.name, this.coerce(value, sf.type));
              return;
            }
          }
          throw makeException('RuntimeException', `${obj.name}.${target.name} に代入できません`, line);
        }
        if (obj.k !== 'obj') throw makeException('RuntimeException', 'フィールドを持たない値です', line);
        const stype = this.staticTypeOf(target.target, scope);
        const f = this.fieldOwner(stype ?? obj.type, target.name) ?? this.fieldOwner(obj.type, target.name);
        if (f) this.writeField(obj, f.info.name, target.name, this.coerce(value, f.decl.type));
        else obj.fields.set(target.name, value);
        return;
      }
      case 'index': {
        const arr = this.eval(target.target, scope);
        const i = toNumber(this.eval(target.index, scope)) | 0;
        if (arr.k !== 'arr') throw makeException('NullPointerException', '配列が null、または配列ではありません', line);
        if (i < 0 || i >= arr.items.length) {
          throw makeException('ArrayIndexOutOfBoundsException', `Index ${i} out of bounds for length ${arr.items.length}`, line);
        }
        arr.items[i] = this.coerce(value, { name: arr.elemType, dims: 0, pos: { line, col: 0 } });
        return;
      }
      default:
        throw makeException('RuntimeException', '代入できない式です', line);
    }
  }

  private staticFieldDecl(className: string, name: string): FieldDecl | null {
    let cur: string | null = className;
    let guard = 0;
    while (cur && guard++ < 30) {
      const info = this.classes.get(cur);
      if (!info) return null;
      const f = info.fields.find((ff) => ff.name === name);
      if (f) return f;
      cur = info.superName;
    }
    return null;
  }

  private staticField(className: string, name: string): JValue | undefined {
    let cur: string | null = className;
    let guard = 0;
    while (cur && guard++ < 30) {
      const info = this.classes.get(cur);
      if (!info) {
        // 標準ライブラリの定数
        if (name === 'MAX_VALUE' && cur === 'Integer') return I(2147483647);
        return undefined;
      }
      this.ensureStaticInit(info);
      if (info.staticFields.has(name)) return info.staticFields.get(name);
      cur = info.superName;
    }
    return undefined;
  }

  private staticConst(className: string, name: string): JValue | undefined {
    const consts: Record<string, JValue> = {
      'Integer.MAX_VALUE': I(2147483647),
      'Integer.MIN_VALUE': I(-2147483648),
      'Long.MAX_VALUE': pri('long', 9223372036854775807n),
      'Long.MIN_VALUE': pri('long', -9223372036854775808n),
      'Double.MAX_VALUE': D(Number.MAX_VALUE),
      'Math.PI': D(Math.PI),
      'Math.E': D(Math.E),
    };
    const k = `${className}.${name}`;
    if (consts[k]) return consts[k];
    const info = this.classes.get(className);
    if (info) {
      this.ensureStaticInit(info);
      return info.staticFields.get(name);
    }
    return undefined;
  }

  private userEquals(o: JObj, arg: JValue): JValue | undefined {
    const m = this.findMethod(o.type, 'equals', 1);
    if (!m) return undefined;
    const owner = this.classOfFromMethod(m);
    if (owner === 'Object') return undefined;
    return this.invokeMethod(o, m, [arg], 0);
  }

  private userCompare(o: JObj, arg: JValue): number | undefined {
    const m = this.findMethod(o.type, 'compareTo', 1);
    if (!m) return undefined;
    const r = this.invokeMethod(o, m, [arg], 0);
    return toNumber(r);
  }

  /* ── 演算 ─────────────────────────────────────────── */
  private numericPromote(v: JValue): Extract<JValue, { k: 'pri' }> {
    if (v.k === 'null') throw makeException('NullPointerException', 'null を数値として使えません');
    if (v.k === 'pri') {
      if (v.t === 'byte' || v.t === 'short' || v.t === 'char') return I(toNumber(v));
      return v;
    }
    if (v.k === 'obj' && v.native?.kind === 'box') return this.numericPromote(v.native.value);
    throw makeException('RuntimeException', '数値が必要です');
  }

  private addNumeric(a: JValue, b: JValue, op: string, line: number): JValue {
    return this.binaryOp(op, a, b, line);
  }

  binaryOp(op: string, a: JValue, b: JValue, line: number): JValue {
    // 文字列連結
    if (op === '+') {
      const aStr = a.k === 'obj' && (a.type === 'String' || a.type === 'StringBuilder');
      const bStr = b.k === 'obj' && (b.type === 'String' || b.type === 'StringBuilder');
      if (aStr || bStr) {
        return newString(this.toStringDispatch(a) + this.toStringDispatch(b));
      }
    }
    if (op === '==' || op === '!=') {
      let eq: boolean;
      const boxA = a.k === 'obj' ? a.native?.kind === 'box' : null;
      const boxB = b.k === 'obj' ? b.native?.kind === 'box' : null;
      if (a.k === 'pri' && b.k === 'pri') {
        if (a.t === 'boolean' || b.t === 'boolean') eq = a.v === b.v;
        else eq = toNumber(a) === toNumber(b);
      } else if (a.k === 'null' || b.k === 'null') {
        eq = a.k === 'null' && b.k === 'null';
      } else if ((a.k === 'pri' && boxB) || (b.k === 'pri' && boxA)) {
        // 片方がプリミティブなら、ボクシングは外されて数値比較になる
        eq = toNumber(this.numericPromote(a)) === toNumber(this.numericPromote(b));
      } else {
        eq = refEquals(a, b);
      }
      return eq === (op === '==') ? TRUE_() : FALSE_();
    }
    if (op === '&' && a.k === 'pri' && a.t === 'boolean' && b.k === 'pri' && b.t === 'boolean') {
      return truthy(a) && truthy(b) ? TRUE_() : FALSE_();
    }
    if (op === '|' && a.k === 'pri' && a.t === 'boolean' && b.k === 'pri' && b.t === 'boolean') {
      return truthy(a) || truthy(b) ? TRUE_() : FALSE_();
    }
    if (op === '^' && a.k === 'pri' && a.t === 'boolean' && b.k === 'pri' && b.t === 'boolean') {
      return truthy(a) !== truthy(b) ? TRUE_() : FALSE_();
    }

    const pa = this.numericPromote(a);
    const pb = this.numericPromote(b);
    const type = promoteType(pa.t, pb.t);

    if (['<', '>', '<=', '>='].includes(op)) {
      const x = toNumber(pa), y = toNumber(pb);
      const r = op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
      return r ? TRUE_() : FALSE_();
    }

    if (op === '<<' || op === '>>' || op === '>>>') {
      if (type === 'long') {
        const l = toLongBig(pa);
        const shift = BigInt(Number(toLongBig(pb) & 63n));
        if (op === '<<') return pri('long', BigInt.asIntN(64, l << shift));
        if (op === '>>') return pri('long', l >> shift);
        return pri('long', BigInt.asIntN(64, BigInt.asUintN(64, l) >> shift));
      }
      const l = toNumber(pa) | 0;
      const shift = toNumber(pb) & 31;
      if (op === '<<') return I(l << shift);
      if (op === '>>') return I(l >> shift);
      return I(l >>> shift);
    }

    if (type === 'double' || type === 'float') {
      const x = toNumber(pa), y = toNumber(pb);
      let r: number;
      switch (op) {
        case '+': r = x + y; break;
        case '-': r = x - y; break;
        case '*': r = x * y; break;
        case '/': r = x / y; break;
        case '%': r = x % y; break;
        default:
          throw makeException('RuntimeException', `未対応の演算子 ${op}`, line);
      }
      return type === 'float' ? pri('float', r) : D(r);
    }

    if (type === 'long') {
      const x = toLongBig(pa), y = toLongBig(pb);
      switch (op) {
        case '+': return pri('long', longAdd(x, y));
        case '-': return pri('long', BigInt.asIntN(64, x - y));
        case '*': return pri('long', longMul(x, y));
        case '/': return pri('long', longDiv(x, y, line));
        case '%': return pri('long', longRem(x, y, line));
        case '&': return pri('long', x & y);
        case '|': return pri('long', x | y);
        case '^': return pri('long', x ^ y);
        default: throw makeException('RuntimeException', `未対応の演算子 ${op}`, line);
      }
    }

    const x = toNumber(pa) | 0;
    const y = toNumber(pb) | 0;
    switch (op) {
      case '+': return I(intAdd(x, y));
      case '-': return I((x - y) | 0);
      case '*': return I(intMul(x, y));
      case '/': return I(intDiv(x, y, line));
      case '%': return I(intRem(x, y, line));
      case '&': return I(x & y);
      case '|': return I(x | y);
      case '^': return I(x ^ y);
      default:
        throw makeException('RuntimeException', `未対応の演算子 ${op}`, line);
    }
  }

  /* ── 型変換 ───────────────────────────────────────── */
  coerce(v: JValue, type: TypeRef): JValue {
    if (type.dims > 0) return v;
    const name = this.resolveTypeClassName(type.name);
    // null をプリミティブへ（自動アンボクシング）は NullPointerException（JLS 5.1.8）
    if (v.k === 'null' && PRIM_NAMES.has(name)) {
      throw makeException('NullPointerException', `null を ${name} に変換できません`);
    }
    switch (name) {
      case 'int':
        if (v.k === 'pri') {
          if (v.t === 'double' || v.t === 'float') return I(Math.trunc(toNumber(v)) | 0);
          return I(toNumber(v));
        }
        if (v.k === 'obj' && v.native?.kind === 'box') return this.coerce(v.native.value, type);
        return I(0);
      case 'long':
        if (v.k === 'pri') {
          if (v.t === 'double' || v.t === 'float') return pri('long', BigInt(Math.trunc(toNumber(v))));
          return pri('long', toLongBig(v));
        }
        if (v.k === 'obj' && v.native?.kind === 'box') return this.coerce(v.native.value, type);
        return pri('long', 0n);
      case 'double':
        if (v.k === 'pri') return D(toNumber(v));
        if (v.k === 'obj' && v.native?.kind === 'box') return this.coerce(v.native.value, type);
        return D(0);
      case 'float':
        if (v.k === 'pri') return pri('float', toNumber(v));
        if (v.k === 'obj' && v.native?.kind === 'box') return this.coerce(v.native.value, type);
        return pri('float', 0);
      case 'char':
        if (v.k === 'pri') {
          if (v.t === 'char') return v;
          return pri('char', String.fromCharCode(Math.trunc(toNumber(v)) & 0xffff));
        }
        return pri('char', '\0');
      case 'boolean':
        if (v.k === 'pri' && v.t === 'boolean') return v;
        if (v.k === 'obj' && v.native?.kind === 'box') return this.coerce(v.native.value, type);
        return FALSE_();
      case 'byte':
        if (v.k === 'pri') return { k: 'pri', t: 'byte', v: toNumber(v) | 0 };
        return { k: 'pri', t: 'byte', v: 0 };
      case 'short':
        if (v.k === 'pri') return { k: 'pri', t: 'short', v: toNumber(v) | 0 };
        return { k: 'pri', t: 'short', v: 0 };
      case 'Integer':
      case 'Double':
      case 'Long':
      case 'Boolean':
      case 'Character':
      case 'Float': {
        if (v.k === 'pri') return boxed(v);
        if (v.k === 'null') return v;
        // 型消去のため、実行時に初めて気づくキャスト（List<Integer> に String が入っていた等）
        if (v.k === 'obj' && v.type !== name && !(v.native?.kind === 'box')) {
          throw makeException('ClassCastException', `${v.type} cannot be cast to ${name}`);
        }
        return v;
      }
      case 'Object':
      case 'Number':
      case 'CharSequence':
        if (v.k === 'pri') return boxed(v);
        return v;
      default:
        return v;
    }
  }

  castTo(type: TypeRef, v: JValue, line: number): JValue {
    const name = this.resolveTypeClassName(type.name);
    if (type.dims > 0) return v;
    const fromPrim = v.k === 'pri';
    if (fromPrim) {
      const n = toNumber(v);
      switch (name) {
        case 'int':
          if (v.t === 'double' || v.t === 'float') {
            if (Number.isNaN(n)) return I(0);
            if (n >= 2147483647) return I(2147483647);
            if (n <= -2147483648) return I(-2147483648);
            return I(Math.trunc(n));
          }
          if (v.t === 'long') return I(Number(BigInt.asIntN(32, v.v as bigint)));
          return I(n | 0);
        case 'byte': return { k: 'pri', t: 'byte', v: ((n << 24) >> 24) | 0 };
        case 'short': return { k: 'pri', t: 'short', v: ((n << 16) >> 16) | 0 };
        case 'char': return pri('char', String.fromCharCode((Math.trunc(n) | 0) & 0xffff));
        case 'long':
          if (v.t === 'double' || v.t === 'float') return pri('long', BigInt(Math.trunc(n)));
          return pri('long', toLongBig(v));
        case 'float': return pri('float', n);
        case 'double': return D(n);
        default:
          return v;
      }
    }
    if (v.k === 'null') return v;
    if (v.k === 'obj') {
      const boxedPrim = v.native?.kind === 'box';
      if (boxedPrim) {
        const primType = { Integer: 'int', Double: 'double', Long: 'long', Boolean: 'boolean', Character: 'char', Float: 'float' }[v.type];
        if (primType) return this.castTo(type, v.native!.kind === 'box' ? (v.native as any).value : v, line);
      }
      if (name === 'Object') return v;
      if (!this.isSubtype(v.type, name) && !BUILTIN_PARENT[name]) {
        throw makeException('ClassCastException', `class ${v.type} cannot be cast to class ${name}`, line);
      }
      if (!this.isSubtype(v.type, name) && BUILTIN_PARENT[name]) {
        throw makeException('ClassCastException', `class ${v.type} cannot be cast to class ${name}`, line);
      }
      return v;
    }
    return v;
  }

  /** Java のオブジェクト表示。ユーザ定義の toString() を必ず経由する。 */
  toStringDispatch(v: JValue): string {
    if (v.k === 'obj' && !v.native) {
      const info = this.classes.get(v.type);
      if (info?.isEnum) {
        const nm = v.fields.get('__name');
        if (nm) return toStringJava(nm);
      }
      const m = this.findMethod(v.type, 'toString', 0);
      if (m) {
        try {
          const r = this.invokeMethod(v, m, [], 0);
          return toStringJava(r);
        } catch {
          return toStringJava(v);
        }
      }
    }
    return toStringJava(v);
  }

  /* ── 出力・記録 ───────────────────────────────────── */
  write(s: string, newline: boolean) {
    if (s.includes('\n')) {
      const parts = s.split('\n');
      for (let i = 0; i < parts.length; i++) {
        const last = i === parts.length - 1;
        if (last && !newline) this.write(parts[i], false);
        else this.write(parts[i], true);
      }
      return;
    }
    if (newline) {
      const line = this.partial + s;
      this.output.push(line);
      this.partial = '';
      this.sink?.println(line);
      if (this.output.length > this.maxOutput) {
        this.truncated = true;
        throw makeException('OutOfMemoryError', `出力が上限(${this.maxOutput}行)を超えました`);
      }
    } else {
      this.partial += s;
      this.sink?.print(s);
    }
    if (this.trace) {
      this.steps.push({
        i: this.steps.length,
        line: this.curLine(),
        kind: 'print',
        label: newline ? `print "${truncate(s, 48)}"` : `print "${truncate(s, 48)}" (改行なし)`,
        stack: [...this.methodStack],
        // 出力時点の変数を出す（直前の recordStep のスコープを使う）
        vars: this.lastScope ? snapshotVars(this.lastScope) : [],
        outputLen: this.output.length,
      });
    }
  }

  /** 代入・++ の結果を 1 ステップとして記録する（変数表示の変化を追えるように） */
  private traceAssignment(e: Expr, value: JValue, line: number, scope: Scope) {
    if (!this.trace) return;
    if (e.t === 'assign') {
      const name = e.target.t === 'name' ? e.target.name : e.target.t === 'field' ? e.target.name : e.target.t === 'index' ? `${'name' in e.target.target ? (e.target.target as { name?: string }).name ?? '?' : '?'}[…]` : null;
      if (name) this.recordStep(line, 'stmt', `${name} = ${short(value)}`, scope);
      return;
    }
    if ((e.t === 'postfix' || e.t === 'prefix') && e.expr.t === 'name') {
      this.recordStep(line, 'stmt', `${e.expr.name} = ${short(value)}`, scope);
    }
  }

  private recordStep(line: number, kind: TraceStep['kind'], label: string, scope: Scope) {
    this.lastScope = scope;
    if (!this.trace) return;
    if (this.steps.length > 4000) return;
    this.steps.push({
      i: this.steps.length,
      line,
      kind,
      label,
      stack: [...this.methodStack],
      vars: snapshotVars(scope),
      outputLen: this.output.length,
    });
  }

  finish(): string[] {
    if (this.partial) {
      this.output.push(this.partial);
      this.partial = '';
    }
    return this.output;
  }

  getSteps(): TraceStep[] {
    return this.steps;
  }
  getStepCount(): number {
    return this.stepCount;
  }
  isTruncated(): boolean {
    return this.truncated;
  }
}

/* ── 補助 ───────────────────────────────────────────── */

const PRIM_NAMES = new Set(['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short']);

function matchesArity(declared: number, given: number, params: { varargs?: boolean }[]): boolean {
  const last = params[params.length - 1];
  if (last?.varargs) return given >= declared - 1;
  return declared === given;
}

const BUILTIN_STATIC = new Set([
  'Math', 'System', 'Integer', 'Double', 'Long', 'Boolean', 'Character', 'String', 'Arrays', 'Collections',
  'Objects', 'Collectors', 'Optional', 'Comparator', 'List', 'Map', 'Set',
]);

function defaultFor(typeName: string): JValue {
  switch (typeName) {
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
      return FALSE_();
    default:
      return jNull;
  }
}

function FALSE_() {
  return { k: 'pri' as const, t: 'boolean' as const, v: false };
}
function TRUE_() {
  return { k: 'pri' as const, t: 'boolean' as const, v: true };
}

function promoteType(a: string, b: string): 'int' | 'long' | 'float' | 'double' {
  const rank: Record<string, number> = { int: 0, long: 1, float: 2, double: 3 };
  const ra = rank[a] ?? 0;
  const rb = rank[b] ?? 0;
  const r = Math.max(ra, rb);
  return (['int', 'long', 'float', 'double'] as const)[r];
}

function negate(p: { t: string; v: unknown }): JValue {
  if (p.t === 'long') return pri('long', -(p.v as bigint));
  if (p.t === 'double') return D(-(p.v as number));
  if (p.t === 'float') return pri('float', -(p.v as number));
  return I(-(p.v as number));
}

function literalValue(kind: string, value: string | number | boolean | null): JValue {
  switch (kind) {
    case 'int': {
      const raw = String(value);
      if (/^0[xX]/.test(raw)) return I(parseInt(raw.slice(2), 16));
      if (/^0[bB]/.test(raw)) return I(parseInt(raw.slice(2), 2));
      if (/^0[0-7]+$/.test(raw) && raw.length > 1) return I(parseInt(raw, 8));
      return I(Number(raw) | 0);
    }
    case 'long': {
      const raw = String(value);
      if (/^0[xX]/.test(raw)) return pri('long', BigInt.asIntN(64, BigInt(parseInt(raw.slice(2), 16))));
      return pri('long', BigInt(raw));
    }
    case 'double':
      return D(Number(value));
    case 'float':
      return pri('float', Number(value));
    case 'char':
      return pri('char', String(value));
    case 'string':
      return newString(String(value));
    case 'boolean':
      return value ? TRUE_() : FALSE_();
    case 'null':
      return jNull;
    default:
      return jNull;
  }
}

function short(v: JValue): string {
  const s = toStringJava(v);
  return s.length > 40 ? s.slice(0, 37) + '…' : s;
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function snapshotVars(scope: Scope): [string, string][] {
  const out: [string, string][] = [];
  let s: Scope | null = scope;
  const seen = new Set<string>();
  let depth = 0;
  while (s && depth++ < 3) {
    for (const [k, v] of s.vars) {
      if (k.startsWith('__') || seen.has(k)) continue;
      seen.add(k);
      out.push([k, short(v)]);
    }
    s = s.parent;
  }
  return out.slice(0, 10);
}

/* ── 公開 API ─────────────────────────────────────────── */

export function runJava(source: string, opts: RunOptions): RunResult {
  const t0 = performance.now();

  // まずコンパイル時の規則（教材で扱う範囲）を検査する。
  // ここで落ちるものは JDK でもコンパイルできない（tools/verify-java.ts が照合する）。
  const check = checkJava(source, opts.mode);
  if (!check.ok) {
    const first = check.issues[0];
    return {
      ok: false,
      output: [],
      error: null,
      compileError: {
        message: check.issues.length > 1 ? `${first.message}（ほか ${check.issues.length - 1} 件）` : first.message,
        line: first.line,
        col: first.col,
      },
      errorCode: first.code,
      steps: [],
      elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
      truncated: false,
      stepCount: 0,
    };
  }

  let unit: CompilationUnit;
  try {
    unit = opts.mode === 'body' ? parseJavaBody(source) : parseJava(source);
  } catch (e) {
    const t1 = performance.now();
    if (e instanceof ParseError || e instanceof LexError) {
      return {
        ok: false,
        output: [],
        error: null,
        compileError: { message: e.message, line: e.line, col: e.col },
        steps: [],
        elapsedMs: Math.round((t1 - t0) * 100) / 100,
        truncated: false,
        stepCount: 0,
      };
    }
    throw e;
  }

  const interp = new Interpreter(opts);
  try {
    interp.load(unit);
    const entry =
      unit.classes.find((c) => c.methods.some((m) => m.name === 'main' && m.mods.includes('static'))) ??
      unit.classes.find((c) => c.name === 'Main') ??
      unit.classes[0];
    interp.runMain(entry.name);
    const output = interp.finish();
    return {
      ok: true,
      output,
      error: null,
      compileError: null,
      steps: interp.getSteps(),
      elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
      truncated: interp.isTruncated(),
      stepCount: interp.getStepCount(),
    };
  } catch (e) {
    const output = interp.finish();
    if (e instanceof JavaThrow) {
      const t = e.value;
      const nat = t.native?.kind === 'throwable' ? t.native : null;
      return {
        ok: false,
        output,
        error: { type: t.type, message: nat?.message ?? '', line: e.line },
        compileError: null,
        steps: interp.getSteps(),
        elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
        truncated: interp.isTruncated(),
        stepCount: interp.getStepCount(),
      };
    }
    if (e instanceof ReturnSignal) {
      return {
        ok: true,
        output,
        error: null,
        compileError: null,
        steps: interp.getSteps(),
        elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
        truncated: interp.isTruncated(),
        stepCount: interp.getStepCount(),
      };
    }
    const err = e as Error;
    return {
      ok: false,
      output,
      error: { type: 'InternalError', message: err?.message ?? String(e), line: 0 },
      compileError: null,
      steps: interp.getSteps(),
      elapsedMs: Math.round((performance.now() - t0) * 100) / 100,
      truncated: interp.isTruncated(),
      stepCount: interp.getStepCount(),
    };
  }
}

export { display };

/** コレクションの構造変更回数（Iterator の同時変更検査に使う） */
function modCounter(v: JValue): number | null {
  if (v.k !== 'obj') return null;
  const n = (v as { native?: unknown }).native as { kind?: string; modCount?: number } | undefined;
  if (!n || (n.kind !== 'list' && n.kind !== 'set' && n.kind !== 'map')) return null;
  return n.modCount ?? 0;
}
