/**
 * コンパイル時エラーの検出（教材で扱う主要な規則のみ）。
 *
 * これは JDK の代替ではない。教材の問題は必ず OpenJDK 21 の実際の結果と
 * 突き合わせて検証しており（tools/verify-java.ts）、ここで判定できないものは
 * 「JDK の結果を表示する」経路にフォールバックする。
 */
import type { ClassDecl, CompilationUnit, Expr, Stmt, TypeRef } from './ast';
import { parseJava, parseJavaBody, ParseError } from './parser';
import { LexError } from './lexer';

export type CompileErrorCode =
  | 'lossy-conversion'
  | 'incompatible-types'
  | 'cannot-find-symbol'
  | 'missing-return'
  | 'unreachable'
  | 'non-static-from-static'
  | 'final-reassignment'
  | 'duplicate'
  | 'already-defined'
  | 'private-access'
  | 'not-an-array'
  | 'bad-operands'
  | 'incomparable'
  | 'void-value'
  | 'uninitialized'
  | 'abstract-instantiation'
  | 'sealed-violation'
  | 'final-inheritance'
  | 'missing-override'
  | 'unreported-exception'
  | 'not-effectively-final'
  | 'already-caught'
  | 'syntax';

export interface CompileIssue {
  code: CompileErrorCode;
  message: string;
  line: number;
  col: number;
}

interface ClassMeta {
  name: string;
  superName: string | null;
  interfaces: string[];
  fields: Map<string, { type: string; mods: string[] }>;
  methods: Map<string, { ret: string; params: string[]; mods: string[]; throws: string[] }>;
  isAbstract: boolean;
  isInterface: boolean;
  isEnum: boolean;
  /** sealed のときの許可リスト */
  permits?: string[];
  isSealed?: boolean;
  isFinal?: boolean;
  /** 実装が必要な抽象メソッド（name/arity → 宣言元） */
  abstractMethods?: Map<string, string>;
}

const BOX: Record<string, string> = {
  int: 'Integer',
  long: 'Long',
  double: 'Double',
  float: 'Float',
  boolean: 'Boolean',
  char: 'Character',
  byte: 'Byte',
  short: 'Short',
};
const UNBOX: Record<string, string> = Object.fromEntries(Object.entries(BOX).map(([k, v]) => [v, k]));

/** 組み込み型の親（JDK の実際の継承・実装に合わせる） */
const BUILTIN_PARENT: Record<string, string[]> = {
  ArrayList: ['List', 'AbstractList', 'Collection', 'Iterable', 'Object'],
  LinkedList: ['List', 'Deque', 'Queue', 'Collection', 'Iterable', 'Object'],
  List: ['Collection', 'Iterable', 'Object'],
  HashSet: ['Set', 'Collection', 'Iterable', 'Object'],
  LinkedHashSet: ['Set', 'Collection', 'Iterable', 'Object'],
  TreeSet: ['Set', 'Collection', 'Iterable', 'Object'],
  Set: ['Collection', 'Iterable', 'Object'],
  Collection: ['Iterable', 'Object'],
  Iterable: ['Object'],
  HashMap: ['Map', 'AbstractMap', 'Object'],
  LinkedHashMap: ['Map', 'AbstractMap', 'Object'],
  TreeMap: ['Map', 'AbstractMap', 'Object'],
  Map: ['Object'],
  String: ['CharSequence', 'Comparable', 'Object'],
  StringBuilder: ['CharSequence', 'Object'],
  CharSequence: ['Object'],
  Integer: ['Number', 'Comparable', 'Object'],
  Long: ['Number', 'Comparable', 'Object'],
  Double: ['Number', 'Comparable', 'Object'],
  Float: ['Number', 'Comparable', 'Object'],
  Short: ['Number', 'Comparable', 'Object'],
  Byte: ['Number', 'Comparable', 'Object'],
  Number: ['Object'],
  Character: ['Comparable', 'Object'],
  Boolean: ['Comparable', 'Object'],
  Optional: ['Object'],
  Stream: ['Object'],
  IntStream: ['Object'],
  Objects: ['Object'],
  Math: ['Object'],
  Arrays: ['Object'],
  Collections: ['Object'],
  System: ['Object'],
  PrintStream: ['Object'],
  Collectors: ['Object'],
  Comparator: ['Object'],
  Runnable: ['Object'],
  Function: ['Object'],
  Supplier: ['Object'],
  Consumer: ['Object'],
  Predicate: ['Object'],
  Exception: ['Throwable', 'Object'],
  RuntimeException: ['Exception', 'Throwable', 'Object'],
  IllegalArgumentException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  IllegalStateException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  UnsupportedOperationException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  NoSuchElementException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  ArithmeticException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  IndexOutOfBoundsException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  ArrayIndexOutOfBoundsException: ['IndexOutOfBoundsException', 'RuntimeException', 'Exception', 'Throwable', 'Object'],
  NullPointerException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  ClassCastException: ['RuntimeException', 'Exception', 'Throwable', 'Object'],
  NumberFormatException: ['IllegalArgumentException', 'RuntimeException', 'Exception', 'Throwable', 'Object'],
  Error: ['Throwable', 'Object'],
  IOException: ['Exception', 'Throwable', 'Object'],
  ClassNotFoundException: ['ReflectiveOperationException', 'Exception', 'Throwable', 'Object'],
  ReflectiveOperationException: ['Exception', 'Throwable', 'Object'],
  InterruptedException: ['Exception', 'Throwable', 'Object'],
  SQLException: ['Exception', 'Throwable', 'Object'],
  Throwable: ['Object'],
  Object: [],
};

const NUMERIC = new Set(['byte', 'short', 'char', 'int', 'long', 'float', 'double']);
const PRIM = new Set([...NUMERIC, 'boolean', 'void']);
const WIDEN: Record<string, string[]> = {
  byte: ['short', 'int', 'long', 'float', 'double'],
  short: ['int', 'long', 'float', 'double'],
  char: ['int', 'long', 'float', 'double'],
  int: ['long', 'float', 'double'],
  long: ['float', 'double'],
  float: ['double'],
  double: [],
  boolean: [],
};

export interface CheckResult {
  issues: CompileIssue[];
  ok: boolean;
}

export function typeName(t: TypeRef): string {
  const base = t.name;
  return t.dims > 0 ? base + '[]'.repeat(t.dims) : base;
}

class Checker {
  private classes = new Map<string, ClassMeta>();
  private issues: CompileIssue[] = [];
  private classStack: string[] = [];
  private currentRet: string = 'void';
  private isStaticCtx = false;
  /** いま検査しているメソッドが throws で宣言している型 */
  private methodThrows: string[] = [];
  /** いま検査している try が捕まえる型（ネストは積む） */
  private caughtStack: string[][] = [];

  constructor(private unit: CompilationUnit) {}

  run(): CompileIssue[] {
    for (const c of this.unit.classes) this.collect(c, null);
    for (const c of this.unit.classes) this.checkClass(c);
    return this.issues;
  }

  private collect(c: ClassDecl, outer: string | null) {
    const name = outer ? `${outer}$${c.name}` : c.name;
    const meta: ClassMeta = {
      name,
      superName: c.superName,
      interfaces: c.interfaces,
      fields: new Map(),
      methods: new Map(),
      isAbstract: c.mods.includes('abstract') || c.kind === 'interface',
      isInterface: c.kind === 'interface',
      isEnum: c.kind === 'enum',
      permits: c.permits,
      isSealed: c.mods.includes('sealed'),
      isFinal: c.mods.includes('final'),
    };
    for (const f of c.fields) meta.fields.set(f.name, { type: typeName(f.type), mods: f.mods });
    for (const m of c.methods) {
      meta.methods.set(`${m.name}/${m.params.length}`, {
        ret: typeName(m.ret),
        params: m.params.map((p) => typeName(p.type)),
        mods: m.mods,
        throws: m.throwsList ?? [],
      });
    }
    for (const r of c.recordComponents) meta.fields.set(r.name, { type: typeName(r.type), mods: ['final'] });
    for (const e of c.enumConstants) meta.fields.set(e.name, { type: name, mods: ['static', 'final'] });
    const abstractMethods = new Map<string, string>();
    for (const m of c.methods) {
      const isAbstract = !m.body && !m.mods.includes('default') && !m.mods.includes('static');
      if (isAbstract) abstractMethods.set(`${m.name}/${m.params.length}`, name);
    }
    meta.abstractMethods = abstractMethods;
    this.classes.set(name, meta);
    for (const n of c.nested) this.collect(n, name);
  }

  private fieldType(clsName: string, field: string): { type: string; mods: string[]; owner: string } | null {
    let cur: string | null = clsName;
    let guard = 0;
    while (cur && guard++ < 30) {
      const meta = this.classes.get(cur);
      if (!meta) return null;
      const f = meta.fields.get(field);
      if (f) return { ...f, owner: cur };
      cur = meta.superName;
    }
    return null;
  }

  private methodRet(clsName: string, name: string, argc: number): { ret: string; mods: string[]; throws: string[] } | null {
    let cur: string | null = clsName;
    let guard = 0;
    while (cur && guard++ < 30) {
      const meta = this.classes.get(cur);
      if (!meta) return null;
      const m = meta.methods.get(`${name}/${argc}`);
      if (m) return { ret: m.ret, mods: m.mods, throws: m.throws };
      cur = meta.superName;
    }
    return null;
  }

  /** 自作クラスの継承も含めて「チェック例外か」を判定する */
  private checked(t: string): boolean {
    let cur: string | null = t;
    let guard = 0;
    while (cur && guard++ < 20) {
      if (cur === 'RuntimeException' || cur === 'Error') return false;
      const meta = this.classes.get(cur);
      if (meta) cur = meta.superName;
      else return isCheckedException(cur);
    }
    return false;
  }

  /** 例外 t が、いまの文脈（宣言 or try）で処理されているか */
  private handled(t: string): boolean {
    const covers = (declared: string) => {
      if (isSubtypeByName(t, declared)) return true;
      const meta = this.classes.get(declared);
      let cur: string | null = t;
      let guard = 0;
      while (cur && guard++ < 20) {
        const m = this.classes.get(cur);
        if (!m) break;
        if (m.name === declared) return true;
        cur = m.superName;
      }
      return Boolean(meta?.name === declared);
    };
    if (this.methodThrows.some(covers)) return true;
    return this.caughtStack.some((list) => list.some(covers));
  }

  private add(code: CompileErrorCode, message: string, line: number, col = 0) {
    this.issues.push({ code, message, line, col });
  }

  private checkClass(c: ClassDecl) {
    this.checkSealed(c);
    this.checkFinalInheritance(c);
    this.checkAbstractImpl(c);
    this.classStack.push(c.kind === 'interface' ? c.name : c.name);
    for (const f of c.fields) {
      if (f.init) {
        const scope = this.newScope(null);
        this.isStaticCtx = f.mods.includes('static');
        this.expr(f.init, scope);
      }
    }
    for (const m of [...c.methods, ...c.ctors]) {
      if (!m.body) continue;
      this.isStaticCtx = m.mods.includes('static');
      this.currentRet = typeName(m.ret);
      this.methodThrows = m.throwsList ?? [];
      this.caughtStack = [];
      const scope = this.newScope(null);
      for (const p of m.params) scope.vars.set(p.name, { type: typeName(p.type), final: false, args: p.type.args?.map((a) => typeName(a)) });
      this.blockStatements((m.body as { body: Stmt[] }).body ?? [], scope);
      if (this.currentRet !== 'void' && this.currentRet !== '' && !this.returnsValue(m.body)) {
        this.add('missing-return', `メソッド ${m.name} に return 文がありません`, m.pos.line, m.pos.col);
      }
    }
    for (const n of c.nested) this.checkClass(n);
    this.classStack.pop();
  }

  /** private メンバーは宣言したクラスの中からしか触れない（JLS 6.6.1） */
  private checkPrivate(mods: string[], owner: string, name: string, pos: { line: number; col: number }) {
    const here = this.classStack[this.classStack.length - 1];
    if (!mods.includes('private')) return;
    if (here === owner) return;
    this.add('private-access', `${name} は ${owner} の private メンバーです`, pos.line, pos.col);
  }

  private checkPrivateMethod(recvType: string, name: string, pos: { line: number; col: number }) {
    const here = this.classStack[this.classStack.length - 1];
    const meta = this.classes.get(recvType);
    const info = meta?.methods.get(`${name}/0`) ?? meta?.methods.get(`${name}/1`) ?? meta?.methods.get(`${name}/2`);
    if (!info || !info.mods.includes('private')) return;
    if (here === recvType) return;
    this.add('private-access', `${name}() は ${recvType} の private メソッドです`, pos.line, pos.col);
  }

  /** sealed 型を継承/実装してよいのは permits に挙がった型だけ（JLS 8.1.1.2） */
  private checkSealed(c: ClassDecl) {
    const parents = [c.superName, ...c.interfaces].filter((x): x is string => Boolean(x));
    for (const p of parents) {
      const meta = this.classes.get(p);
      if (!meta?.isSealed) continue;
      const allowed = meta.permits ?? [];
      if (!allowed.includes(c.name)) {
        this.add(
          'sealed-violation',
          `sealed な ${p} を実装できるのは ${allowed.join(', ') || '(なし)'} だけです`,
          c.pos.line,
          c.pos.col,
        );
      }
    }
  }

  /** final クラスは継承できない（JLS 8.1.1.2） */
  private checkFinalInheritance(c: ClassDecl) {
    if (!c.superName) return;
    const meta = this.classes.get(c.superName);
    if (!meta?.isFinal) return;
    this.add('final-inheritance', `final クラス ${c.superName} は継承できません`, c.pos.line, c.pos.col);
  }

  /** 具象クラスは継承した抽象メソッドをすべて実装する必要がある（JLS 8.1.1.1） */
  private checkAbstractImpl(c: ClassDecl) {
    if (c.kind !== 'class' || c.mods.includes('abstract')) return;
    const need = new Map<string, string>();
    const visit = (typeName: string | null | undefined) => {
      let cur = typeName ? this.classes.get(typeName) : undefined;
      while (cur) {
        for (const [sig, owner] of cur.abstractMethods ?? []) if (!need.has(sig)) need.set(sig, owner);
        for (const i of cur.interfaces) visit(i);
        cur = cur.superName ? this.classes.get(cur.superName) : undefined;
      }
    };
    visit(c.superName);
    for (const i of c.interfaces) visit(i);
    if (need.size === 0) return;
    const done = new Set<string>();
    for (const m of c.methods) {
      const sig = `${m.name}/${m.params.length}`;
      if (m.body || m.mods.includes('abstract')) done.add(sig);
    }
    for (const [sig, owner] of need) {
      if (done.has(sig)) continue;
      const [name, arity] = sig.split('/');
      this.add(
        'missing-override',
        `${c.name} は ${owner} の抽象メソッド ${name}(${arity === '0' ? '' : '...'}) を実装していません（${c.name} を abstract にするか実装してください）`,
        c.pos.line,
        c.pos.col,
      );
    }
  }

  private returnsValue(s: Stmt | null): boolean {
    if (!s) return false;
    switch (s.t) {
      case 'return':
        return true;
      case 'block':
        return s.body.some((x) => this.returnsValue(x));
      case 'if':
        return this.returnsValue(s.then) && this.returnsValue(s.other);
      case 'try':
        // try 本体か catch のどれかが値を返せばよい。finally が返す必要はない。
        return this.returnsValue(s.body) || s.catches.some((c) => this.returnsValue(c.body));
      case 'switch':
        return s.cases.some((c) => c.body.some((x) => this.returnsValue(x)));
      case 'throw':
        return true;
      default:
        return false;
    }
  }

  private newScope(parent: Scope | null): Scope {
    return { vars: new Map(), parent };
  }

  /* ── 文 ── */
  private blockStatements(stmts: Stmt[], scope: Scope) {
    let terminated = false;
    for (const s of stmts) {
      if (terminated) {
        this.add('unreachable', 'この文には到達できません', s.pos.line, s.pos.col);
        return;
      }
      this.stmt(s, scope);
      if (s.t === 'return' || s.t === 'throw') terminated = true;
    }
  }

  private stmt(s: Stmt, scope: Scope) {
    switch (s.t) {
      case 'var': {
        const declared = typeName(s.type);
        // 同じメソッド内の外側ブロックで宣言済みなら、内側で同名は宣言できない
        for (let sc: Scope | null = scope; sc; sc = sc.parent) {
          if (sc.vars.has(s.name)) {
            this.add('already-defined', `変数 ${s.name} はすでに定義されています`, s.pos.line, s.pos.col);
            break;
          }
        }
        if (s.init) {
          const t = this.expr(s.init, scope);
          const constOk = NUMERIC.has(declared) && this.fitsConstant(declared, this.constIntOf(s.init));
          if (!this.assignable(declared, t) && !constOk) {
            if (NUMERIC.has(declared) && NUMERIC.has(t) && t !== declared) {
              this.add(
                'lossy-conversion',
                `${t} から ${declared} への変換は情報を失う可能性があります`,
                s.pos.line,
                s.pos.col,
              );
            } else if (declared !== 'var' && t !== 'unknown' && t !== 'null') {
              this.add('incompatible-types', `${t} を ${declared} に代入できません`, s.pos.line, s.pos.col);
            }
          }
        }
        scope.vars.set(s.name, {
          type: declared,
          final: Boolean((s as { finalVar?: boolean }).finalVar),
          args: s.type.args?.map((a) => typeName(a)),
        });
        return;
      }
      case 'expr':
        this.expr(s.expr, scope);
        return;
      case 'block':
        this.blockStatements(s.body, this.newScope(scope));
        return;
      case 'if':
        this.expr(s.test, scope);
        this.stmt(s.then, this.newScope(scope));
        if (s.other) this.stmt(s.other, this.newScope(scope));
        return;
      case 'while':
        this.expr(s.test, scope);
        this.stmt(s.body, this.newScope(scope));
        return;
      case 'do':
        this.stmt(s.body, this.newScope(scope));
        this.expr(s.test, scope);
        return;
      case 'for': {
        const inner = this.newScope(scope);
        for (const i of s.init) this.stmt(i, inner);
        if (s.test) this.expr(s.test, inner);
        for (const u of s.update) this.expr(u, inner);
        this.stmt(s.body, this.newScope(inner));
        return;
      }
      case 'foreach': {
        const t = this.expr(s.iter, scope);
        const inner = this.newScope(scope);
        inner.vars.set(s.name, { type: typeName(s.type), final: false });
        if (t !== 'unknown' && !t.endsWith('[]') && !['String', 'List', 'ArrayList', 'Set', 'HashSet', 'Iterable'].includes(t)) {
          this.add('not-an-array', `${t} は拡張 for では扱えません`, s.pos.line, s.pos.col);
        }
        this.stmt(s.body, inner);
        return;
      }
      case 'switch':
        this.expr(s.subject, scope);
        for (const c of s.cases) {
          for (const l of c.labels ?? []) this.expr(l, scope);
          this.blockStatements(c.body, this.newScope(scope));
        }
        return;
      case 'return': {
        if (s.value) {
          const t = this.expr(s.value, scope);
          if (this.currentRet === 'void') {
            this.add('incompatible-types', 'void メソッドは値を返せません', s.pos.line, s.pos.col);
          } else if (!this.assignable(this.currentRet, t) && t !== 'unknown') {
            this.add('incompatible-types', `${t} を ${this.currentRet} として返せません`, s.pos.line, s.pos.col);
          }
        } else if (this.currentRet !== 'void' && this.currentRet !== 'unknown') {
          this.add('missing-return', `${this.currentRet} を返す必要があります`, s.pos.line, s.pos.col);
        }
        return;
      }
      case 'throw': {
        const t = this.expr(s.value, scope);
        if (this.checked(t) && !this.handled(t)) {
          this.add(
            'unreported-exception',
            `例外 ${t} を処理していません（catch するか、メソッドに throws を付けます）`,
            s.pos.line,
            s.pos.col,
          );
        }
        return;
      }
      case 'try': {
        const caught: string[] = [];
        for (const c of s.catches) {
          const seen = caught.find((prev) => isSubtypeByName(c.type.name, prev) || prev === c.type.name);
          if (seen) {
            this.add(
              'already-caught',
              `${c.type.name} はすでに ${seen} で捕まえられているため、この catch には到達できません`,
              c.type.name === undefined ? s.pos.line : s.pos.line,
              s.pos.col,
            );
          }
          caught.push(c.type.name);
        }
        this.caughtStack.push(caught);
        this.blockStatements((s.body as { body: Stmt[] }).body ?? [], this.newScope(scope));
        this.caughtStack.pop();
        for (const c of s.catches) {
          const inner = this.newScope(scope);
          inner.vars.set(c.name, { type: c.type.name, final: false });
          this.blockStatements((c.body as { body: Stmt[] }).body ?? [], inner);
        }
        if (s.fin) this.stmt(s.fin, this.newScope(scope));
        return;
      }
      case 'labeled':
        this.stmt(s.body, scope);
        return;
      case 'break':
      case 'continue':
      case 'empty':
        return;
    }
  }

  /** クラス・インターフェースをたどって継承関係を調べる（組み込み型も含む） */
  private isSubtypeOf(from: string, target: string): boolean {
    if (from === target) return true;
    if (from === 'null' || from === 'unknown') return false;
    const seen = new Set<string>();
    const walk = (cur: string): boolean => {
      if (cur === target) return true;
      if (seen.has(cur) || seen.size > 60) return false;
      seen.add(cur);
      const meta = this.classes.get(cur);
      if (meta) {
        if (meta.superName && walk(meta.superName)) return true;
        return meta.interfaces.some((i) => walk(i));
      }
      const parents = BUILTIN_PARENT[cur];
      return Boolean(parents?.some((x) => walk(x)));
    };
    return walk(from);
  }

  private assignable(target: string, from: string): boolean {
    if (target === 'unknown' || from === 'unknown') return true;
    if (target === from) return true;
    if (from === 'null') return !PRIM.has(target);
    // プリミティブ同士は拡大変換のみ
    if (NUMERIC.has(target) && NUMERIC.has(from)) return (WIDEN[from] ?? []).includes(target);
    if (target === 'boolean' || from === 'boolean') return target === from;
    // 参照型: 継承・interface・ボクシング/アンボクシング
    if (this.isSubtypeOf(from, target)) return true;
    const unboxed = UNBOX[from];
    if (unboxed && NUMERIC.has(target) && NUMERIC.has(unboxed)) return (WIDEN[unboxed] ?? []).includes(target) || unboxed === target;
    if (UNBOX[target] === from) return true; // int → Integer
    if (UNBOX[target] && NUMERIC.has(from) && NUMERIC.has(UNBOX[target])) {
      // Integer に long などは不可（JDK と同じ）。拡大変換してからボクシングはしない。
      return false;
    }
    return false;
  }

  /** 定数式の int 値（byte/short/char への定数代入の判定に使う） */
  private constIntOf(e: Expr): number | null {
    if (e.t === 'lit' && e.kind === 'int') return Number(e.value);
    if (e.t === 'unary' && (e.op === '-' || e.op === '+')) {
      const v = this.constIntOf(e.expr);
      return v === null ? null : e.op === '-' ? -v : v;
    }
    if (e.t === 'cast' && NUMERIC.has(typeName(e.type))) return this.constIntOf(e.expr);
    return null;
  }

  private fitsConstant(target: string, v: number | null): boolean {
    if (v === null) return false;
    if (target === 'byte') return v >= -128 && v <= 127;
    if (target === 'short') return v >= -32768 && v <= 32767;
    if (target === 'char') return v >= 0 && v <= 65535;
    return false;
  }

  /* ── 式 ── */
  private expr(e: Expr, scope: Scope): string {
    switch (e.t) {
      case 'lit':
        switch (e.kind) {
          case 'int':
            return 'int';
          case 'long':
            return 'long';
          case 'double':
            return 'double';
          case 'float':
            return 'float';
          case 'char':
            return 'char';
          case 'string':
            return 'String';
          case 'boolean':
            return 'boolean';
          case 'null':
            return 'null';
        }
        return 'unknown';
      case 'name': {
        let s: Scope | null = scope;
        let crossed = false;
        while (s) {
          const v = s.vars.get(e.name);
          if (v) {
            // ラムダが外側のローカルを参照したら「捕捉」として記録する。
            // 捕捉されたローカルは、あとで再代入があると effectively final でなくなる。
            if (crossed) v.captured = true;
            return v.type;
          }
          if (s.lambda) crossed = true;
          s = s.parent;
        }
        const cls = this.classStack[this.classStack.length - 1];
        const f = this.fieldType(cls, e.name);
        if (f) {
          if (this.isStaticCtx && !f.mods.includes('static')) {
            this.add(
              'non-static-from-static',
              `static から instance フィールド ${e.name} は参照できません`,
              e.pos.line,
              e.pos.col,
            );
          }
          return f.type;
        }
        if (this.classes.has(e.name)) return e.name;
        if (BUILTIN_CLASSES.has(e.name)) return e.name;
        this.add('cannot-find-symbol', `シンボル ${e.name} が見つかりません`, e.pos.line, e.pos.col);
        return 'unknown';
      }
      case 'this':
        return this.classStack[this.classStack.length - 1] ?? 'unknown';
      case 'super':
        return this.classStack.length > 1 ? this.classStack[this.classStack.length - 2] : 'unknown';
      case 'field': {
        if (e.target.t === 'name' && this.classes.has(e.target.name)) {
          const f = this.fieldType(e.target.name, e.name);
          if (f) this.checkPrivate(f.mods, f.owner, e.name, e.pos);
          return f ? f.type : 'unknown';
        }
        if (e.target.t === 'this' || e.target.t === 'super') {
          const cls = this.classStack[this.classStack.length - 1];
          const f = this.fieldType(cls, e.name);
          if (f) this.checkPrivate(f.mods, f.owner, e.name, e.pos);
          return f ? f.type : 'unknown';
        }
        const tt = this.expr(e.target, scope);
        if (tt.endsWith('[]') && e.name === 'length') return 'int';
        if (tt === 'String') return e.name === 'CASE_INSENSITIVE_ORDER' ? 'Comparator' : 'unknown';
        const f = this.fieldType(tt, e.name);
        if (f) {
          this.checkPrivate(f.mods, f.owner, e.name, e.pos);
          return f.type;
        }
        return 'unknown';
      }
      case 'index': {
        const t = this.expr(e.target, scope);
        this.expr(e.index, scope);
        if (t === 'String') return 'char';
        if (t.endsWith('[]')) return t.slice(0, -2);
        if (t !== 'unknown') this.add('not-an-array', `${t} は配列ではありません`, e.pos.line, e.pos.col);
        return 'unknown';
      }
      case 'call':
        return this.call(e, scope);
      case 'new': {
        for (const a of e.args) this.expr(a, scope);
        for (const a of e.arrayInit ?? []) this.expr(a, scope);
        for (const d of e.arrayDims ?? []) if (d) this.expr(d, scope);
        const meta = this.classes.get(e.typeName);
        // `Animal[] xs = { new Dog() }` は Animal を new しているわけではない
        if (meta?.isAbstract && !e.arrayInit) {
          this.add('abstract-instantiation', `抽象クラス ${e.typeName} は new できません`, e.pos.line, e.pos.col);
        }
        if (e.arrayInit) return e.typeName + '[]'.repeat(e.initDims ?? 1);
        const dims = e.arrayDims ? '[]'.repeat(e.arrayDims.length) : '';
        return e.typeName + dims;
      }
      case 'unary': {
        const t = this.expr(e.expr, scope);
        if (e.op === '!') {
          if (t !== 'boolean' && t !== 'unknown') this.add('bad-operands', `! は boolean にだけ使えます（${t}）`, e.pos.line, e.pos.col);
          return 'boolean';
        }
        if (e.op === '~') return t === 'long' ? 'long' : 'int';
        if (NUMERIC.has(t)) return t === 'byte' || t === 'short' || t === 'char' ? 'int' : t;
        if (t !== 'unknown') this.add('bad-operands', `${e.op} は数値にだけ使えます（${t}）`, e.pos.line, e.pos.col);
        return 'unknown';
      }
      case 'prefix':
      case 'postfix': {
        const t = this.expr(e.expr, scope);
        // ++ は代入と同じ。「実質的に final」の規則がかかる。
        this.checkFinal(e.expr, scope, e.pos.line, e.pos.col);
        return t;
      }
      case 'binary': {
        const lRaw = this.expr(e.left, scope);
        const rRaw = this.expr(e.right, scope);
        // Integer + Integer は自動アンボクシングされる
        const l = UNBOX[lRaw] ?? lRaw;
        const r = UNBOX[rRaw] ?? rRaw;
        switch (e.op) {
          case '+':
            if (l === 'String' || r === 'String') return 'String';
            if (NUMERIC.has(l) && NUMERIC.has(r)) return promote(l, r);
            if (l !== 'unknown' && r !== 'unknown') this.add('bad-operands', `${l} と ${r} は + できません`, e.pos.line, e.pos.col);
            return 'unknown';
          case '-':
          case '*':
          case '/':
          case '%':
            if (NUMERIC.has(l) && NUMERIC.has(r)) return promote(l, r);
            if (l !== 'unknown' && r !== 'unknown') {
              this.add('bad-operands', `${l} と ${r} に ${e.op} は使えません`, e.pos.line, e.pos.col);
            }
            return 'unknown';
          case '<':
          case '>':
          case '<=':
          case '>=':
            if (NUMERIC.has(l) && NUMERIC.has(r)) return 'boolean';
            if (l !== 'unknown' && r !== 'unknown') this.add('bad-operands', `${l} と ${r} は比較できません`, e.pos.line, e.pos.col);
            return 'boolean';
          case '==':
          case '!=': {
            // 参照型同士（Integer と Integer）も、プリミティブとの比較（アンボクシング）も合法
            if (l !== 'unknown' && r !== 'unknown' && l !== 'null' && r !== 'null') {
              const lNum = NUMERIC.has(l) || l === 'boolean';
              const rNum = NUMERIC.has(r) || r === 'boolean';
              const lRef = !PRIM.has(l);
              const rRef = !PRIM.has(r);
              if (lNum && rRef && lRef && rRef) {
                // 片方が数値でもう片方が参照 → 参照同士の比較として合法
              } else if (!(lNum && rNum) && !(lRef && rRef)) {
                this.add('incomparable', `${l} と ${r} は比較できません`, e.pos.line, e.pos.col);
              }
            }
            return 'boolean';
          }
          case '&&':
          case '||':
            if (l !== 'boolean' && l !== 'unknown') this.add('bad-operands', `${l} は論理演算に使えません`, e.pos.line, e.pos.col);
            return 'boolean';
          default:
            if (NUMERIC.has(l) && NUMERIC.has(r)) return promote(l, r);
            return 'unknown';
        }
      }
      case 'assign': {
        const lt = this.targetType(e.target, scope);
        const rt = this.expr(e.value, scope);
        // 複合代入（+= -= など）は暗黙の narrowing を含むため、型の狭まりはエラーにしない
        if (e.op === '=' && !this.assignable(lt, rt) && rt !== 'unknown' && lt !== 'unknown') {
          if (NUMERIC.has(lt) && NUMERIC.has(rt)) this.add('lossy-conversion', `${rt} を ${lt} に代入すると情報が失われます`, e.pos.line, e.pos.col);
          else this.add('incompatible-types', `${rt} を ${lt} に代入できません`, e.pos.line, e.pos.col);
        }
        this.checkFinal(e.target, scope, e.pos.line, e.pos.col);
        return lt;
      }
      case 'cond': {
        this.expr(e.test, scope);
        const a = this.expr(e.then, scope);
        const b = this.expr(e.other, scope);
        if (a === b) return a;
        if (NUMERIC.has(a) && NUMERIC.has(b)) return promote(a, b);
        return a === 'null' ? b : a;
      }
      case 'cast':
        return this.expr(e.expr, scope) === 'unknown' ? typeName(e.type) : typeName(e.type);
      case 'instanceof':
        this.expr(e.expr, scope);
        return 'boolean';
      case 'lambda': {
        const inner = this.newScope(scope);
        inner.lambda = true;
        for (const name of e.params) inner.vars.set(name, { type: 'unknown', final: false });
        const prevRet = this.currentRet;
        this.currentRet = 'unknown';
        try {
          const body = e.body as Stmt;
          if (body.t === 'block') this.blockStatements((body as { body: Stmt[] }).body ?? [], inner);
          else this.expr(e.body as Expr, inner);
        } finally {
          this.currentRet = prevRet;
        }
        return 'unknown';
      }
      case 'methodref':
        return 'unknown';
    }
  }

  /** List<E> / Set<E> / Map<K,V> の要素型と実引数の食い違いを検出する */
  private checkTypeArgs(v: { type: string; args?: string[] }, method: string, argTypes: string[], e: Extract<Expr, { t: 'call' }>) {
    const args = v.args;
    if (!args || args.length === 0) return;
    const seq = ['List', 'ArrayList', 'LinkedList', 'Set', 'HashSet', 'Collection', 'Queue', 'Deque', 'Iterable'];
    const check = (want: string | undefined, got: string | undefined) => {
      if (!want || !got) return;
      if (this.assignable(want, got)) return;
      this.add('incompatible-types', `${got} を ${want} として扱えません（${v.type} の型引数）`, e.pos.line, e.pos.col);
    };
    if (seq.includes(v.type) && ['add', 'set', 'contains', 'remove'].includes(method)) {
      // List.set(int index, E element) は要素が 2 番目の引数。
      // List.remove(int index) は添字なので要素型の検査をしない（remove(Object) はする）。
      const integral = ['int', 'long', 'short', 'byte', 'Integer', 'Long'];
      if (method === 'set') check(args[0], argTypes[1]);
      else if (method === 'remove' && integral.includes(argTypes[0] ?? '')) return;
      else check(args[0], argTypes[0]);
    }
    if (v.type === 'Map') {
      if (method === 'put' && args.length >= 2) {
        check(args[0], argTypes[0]);
        check(args[1], argTypes[1]);
      }
      if (method === 'containsKey' || method === 'getOrDefault') check(args[0], argTypes[0]);
    }
  }

  private checkFinal(target: Expr, scope: Scope, line: number, col: number) {
    if (target.t !== 'name') return;
    let s: Scope | null = scope;
    let crossedLambda = false;
    while (s) {
      const v = s.vars.get(target.name);
      if (v) {
        if (v.final) this.add('final-reassignment', `final 変数 ${target.name} に再代入できません`, line, col);
        // ラムダに捕捉された外側のローカル変数は、あとから再代入できない（JLS 4.12.4）
        if (v.captured && !v.final) {
          this.add(
            'not-effectively-final',
            `ラムダが参照した変数 ${target.name} は実質的に final でなければなりません`,
            line,
            col,
          );
          return;
        }
        // ラムダの外側のローカル変数は「実質的に final」でなければならない
        if (crossedLambda) {
          this.add(
            'not-effectively-final',
            `ラムダは外側の変数 ${target.name} を変更できません（実質的に final である必要があります）`,
            line,
            col,
          );
        }
        return;
      }
      if (s.lambda) crossedLambda = true;
      s = s.parent;
    }
  }

  private targetType(target: Expr, scope: Scope): string {
    if (target.t === 'name') {
      let s: Scope | null = scope;
      while (s) {
        const v = s.vars.get(target.name);
        if (v) return v.type;
        s = s.parent;
      }
      const clsName = this.classStack[this.classStack.length - 1];
      const fld = this.fieldType(clsName, target.name);
      if (fld) {
        if (this.isStaticCtx && !fld.mods.includes('static')) {
          this.add(
            'non-static-from-static',
            `static から instance フィールド ${target.name} は変更できません`,
            target.pos.line,
            target.pos.col,
          );
        }
        return fld.type;
      }
      const cls = this.classStack[this.classStack.length - 1];
      const f = this.fieldType(cls, target.name);
      return f ? f.type : 'unknown';
    }
    if (target.t === 'field') {
      const tt = target.target.t === 'this' ? this.classStack[this.classStack.length - 1] : this.expr(target.target, scope);
      const f = this.fieldType(tt, target.name);
      return f ? f.type : 'unknown';
    }
    if (target.t === 'index') {
      const t = this.expr(target.target, scope);
      return t.endsWith('[]') ? t.slice(0, -2) : 'unknown';
    }
    return 'unknown';
  }

  /** 呼び出したメソッドが投げるチェック例外が処理されているか確かめる */
  private checkThrows(throws: string[] | undefined, e: Extract<Expr, { t: 'call' }>) {
    for (const t of throws ?? []) {
      if (this.checked(t) && !this.handled(t)) {
        this.add(
          'unreported-exception',
          `例外 ${t} を処理していません（catch するか、メソッドに throws を付けます）`,
          e.pos.line,
          e.pos.col,
        );
      }
    }
  }

  private call(e: Extract<Expr, { t: 'call' }>, scope: Scope): string {
    const argTypes = e.args.map((a) => this.expr(a, scope));
    if (!e.target) {
      const cls = this.classStack[this.classStack.length - 1];
      const m = this.methodRet(cls, e.name, argTypes.length);
      if (m) {
        this.checkThrows(m.throws, e);
        return m.ret;
      }
      if (lookupBuiltin(BUILTIN_STATIC_METHODS, `${cls}.${e.name}`)) return lookupBuiltin(BUILTIN_STATIC_METHODS, `${cls}.${e.name}`)!;
      return 'unknown';
    }
    if (e.target.t === 'name' && (this.classes.has(e.target.name) || BUILTIN_CLASSES.has(e.target.name))) {
      const name = e.target.name;
      const m = this.methodRet(name, e.name, argTypes.length);
      if (m) {
        if (this.isStaticCtx === false && m.mods.includes('static')) return m.ret;
        this.checkThrows(m.throws, e);
        return m.ret;
      }
      const key = `${name}.${e.name}`;
      if (lookupBuiltin(BUILTIN_STATIC_METHODS, key)) return lookupBuiltin(BUILTIN_STATIC_METHODS, key)!;
      // enum の暗黙メソッド
      if (this.classes.get(name)?.isEnum) {
        if (e.name === 'values') return name + '[]';
        if (e.name === 'valueOf') return name;
      }
      if (BUILTIN_CLASSES.has(name)) return 'unknown';
      this.add('cannot-find-symbol', `${name}.${e.name}() が見つかりません`, e.pos.line, e.pos.col);
      return 'unknown';
    }
    if (e.target.t === 'this' && (e.name === 'this' || e.name === 'super')) return 'void';
    const recv = this.expr(e.target, scope);
    // 配列に length() は無い（length はフィールド）。String の length() と混同しやすい
    if (recv.endsWith('[]') && e.name === 'length') {
      this.add('cannot-find-symbol', `配列 ${recv} に length() はありません（length はフィールド）`, e.pos.line, e.pos.col);
      return 'unknown';
    }
    const m = this.methodRet(recv, e.name, argTypes.length);
    if (m) {
      this.checkPrivateMethod(recv, e.name, e.pos);
      this.checkThrows(m.throws, e);
      return m.ret;
    }
    // List<Integer> に String を add する、のような型引数の食い違い
    if (e.target.t === 'name') {
      let sc: Scope | null = scope;
      while (sc) {
        const v = sc.vars.get(e.target.name);
        if (v) {
          this.checkTypeArgs(v, e.name, argTypes, e);
          break;
        }
        sc = sc.parent;
      }
    }
    const builtin = lookupBuiltin(BUILTIN_INSTANCE_METHODS, `${recv}.${e.name}`);
    if (builtin) return builtin;
    const star = lookupBuiltin(BUILTIN_INSTANCE_METHODS, `*.${e.name}`);
    if (star) return star;
    return 'unknown';
  }
}

interface Scope {
  vars: Map<string, { type: string; final: boolean; args?: string[]; captured?: boolean }>;
  parent: Scope | null;
  /** ラムダの本体。外側の変数を書き換えるとコンパイルできない。 */
  lambda?: boolean;
}

/** チェック済み（catch か throws が必須）の例外か（組み込み型の判定） */
function isCheckedException(name: string): boolean {
  if (name === 'Exception' || name === 'Throwable' || name === 'IOException' || name === 'SQLException') return true;
  if (name === 'ClassNotFoundException' || name === 'InterruptedException') return true;
  if (name === 'RuntimeException' || name === 'Error') return false;
  const parents: string[] | undefined = BUILTIN_PARENT[name];
  if (!parents) return false;
  if (parents.includes('RuntimeException') || parents.includes('Error')) return false;
  return parents.includes('Exception') || parents.includes('Throwable');
}

function isSubtypeByName(from: string, target: string): boolean {
  if (from === target) return true;
  const seen = new Set<string>();
  const stack: string[] = [from];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const parents: string[] | undefined = BUILTIN_PARENT[cur];
    if (parents) stack.push(...parents);
  }
  return false;
}

function promote(a: string, b: string): string {
  const rank = ['byte', 'short', 'char', 'int', 'long', 'float', 'double'];
  const ra = rank.indexOf(a);
  const rb = rank.indexOf(b);
  if (ra < 3 && rb < 3) return 'int';
  return rank[Math.max(ra, rb)] ?? 'int';
}

function lookupBuiltin(table: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

const BUILTIN_CLASSES = new Set([
  'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Object', 'Math', 'System', 'Arrays',
  'Collections', 'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet', 'Optional', 'Stream', 'StringBuilder',
  'Exception', 'RuntimeException', 'IllegalArgumentException', 'IOException', 'Objects', 'Collectors', 'Comparator',
  'CharSequence', 'Number', 'Iterable', 'Runnable', 'Function', 'Supplier', 'Consumer', 'Predicate',
]);

const BUILTIN_STATIC_METHODS: Record<string, string> = {
  'Math.max': 'int',
  'Math.min': 'int',
  'Math.abs': 'int',
  'Math.pow': 'double',
  'Math.sqrt': 'double',
  'Math.round': 'int', // float 引数なら int、double なら long。教材では float 版だけを使う
  'String.valueOf': 'String',
  'String.format': 'String',
  'String.join': 'String',
  'Integer.parseInt': 'int',
  'Integer.valueOf': 'Integer',
  'Double.parseDouble': 'double',
  'Arrays.toString': 'String',
  'Arrays.asList': 'List',
  'Arrays.sort': 'void',
  'Collections.sort': 'void',
  'Objects.equals': 'boolean',
  'Optional.of': 'Optional',
  'Optional.empty': 'Optional',
  'System.out': 'PrintStream',
  'Collectors.toList': 'Collector',
  'Integer.MAX_VALUE': 'int',
  'Integer.MIN_VALUE': 'int',
};

const BUILTIN_INSTANCE_METHODS: Record<string, string> = {
  'String.length': 'int',
  'String.charAt': 'char',
  'String.substring': 'String',
  'String.indexOf': 'int',
  'String.equals': 'boolean',
  'String.equalsIgnoreCase': 'boolean',
  'String.contains': 'boolean',
  'String.startsWith': 'boolean',
  'String.endsWith': 'boolean',
  'String.toUpperCase': 'String',
  'String.toLowerCase': 'String',
  'String.trim': 'String',
  'String.replace': 'String',
  'String.split': 'String[]',
  'String.isEmpty': 'boolean',
  'String.repeat': 'String',
  'String.toCharArray': 'char[]',
  'String.compareTo': 'int',
  'List.add': 'boolean',
  'List.get': 'unknown',
  'List.size': 'int',
  'List.contains': 'boolean',
  'List.remove': 'unknown',
  'List.stream': 'Stream',
  'List.toString': 'String',
  'Map.put': 'unknown',
  'Map.get': 'unknown',
  'Map.getOrDefault': 'unknown',
  'Map.containsKey': 'boolean',
  'Map.size': 'int',
  'Map.keySet': 'Set',
  'Map.values': 'List',
  'Optional.isPresent': 'boolean',
  'Optional.get': 'unknown',
  'Optional.orElse': 'unknown',
  'Optional.map': 'Optional',
  'Stream.filter': 'Stream',
  'Stream.map': 'Stream',
  'Stream.mapToInt': 'Stream',
  'Stream.collect': 'List',
  'Stream.count': 'long',
  'Stream.sum': 'int',
  'Stream.findFirst': 'Optional',
  'Stream.max': 'Optional',
  'Stream.min': 'Optional',
  'StringBuilder.append': 'StringBuilder',
  'StringBuilder.toString': 'String',
  'PrintStream.println': 'void',
  'PrintStream.print': 'void',
  '*.toString': 'String',
  '*.equals': 'boolean',
  '*.hashCode': 'int',
};

export function checkJava(source: string, mode: 'body' | 'unit'): CheckResult {
  let unit: CompilationUnit;
  try {
    unit = mode === 'body' ? parseJavaBody(source) : parseJava(source);
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexError) {
      return { ok: false, issues: [{ code: 'syntax', message: e.message, line: e.line, col: e.col }] };
    }
    throw e;
  }
  const issues = new Checker(unit).run();
  // 同じ位置・同じコードの重複を除く
  const seen = new Set<string>();
  const unique = issues.filter((i) => {
    const k = `${i.code}:${i.line}:${i.col}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ok: unique.length === 0, issues: unique };
}
