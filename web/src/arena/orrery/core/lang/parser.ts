/**
 * Recursive-descent parser for the ORRERY teaching subset.
 *
 * It deliberately accepts *surface syntax* that looks like real Java / Rust
 * (modifiers, declared types, `class ... { main }`, `fn main`, `impl`, `match`,
 * `println!`) while keeping a small, well-defined AST. It is NOT a full Java or
 * Rust parser; unsupported constructs produce a clear error instead of
 * silently pretending to compile. See README "Runtime honesty".
 */
import { lex, MODIFIERS, type Token } from './lexer';
import type {
  ClassDef, Dialect, Expr, FieldDef, LangError, MatchArm, MatchPattern,
  MethodDef, Param, Pos, Program, Stmt,
} from './ast';

class ParseFailure extends Error {
  constructor(readonly error: LangError) {
    super(error.message);
  }
}

const STATEMENT_WORDS = new Set([
  'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'new', 'match',
  'fn', 'class', 'interface', 'enum', 'record', 'struct', 'impl', 'package',
  'import', 'use', 'throw', 'loop', 'in', 'as', 'where', 'true', 'false', 'null',
  'None', 'Some', 'Ok', 'Err', 'this', 'self', 'super', 'let',
]);

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=']);
const CLASS_WORDS = new Set(['class', 'interface', 'enum', 'record', 'struct']);

export function parse(source: string, dialect: Dialect): { program: Program | null; error: LangError | null } {
  const { tokens, error } = lex(source);
  if (error) return { program: null, error };
  try {
    return { program: new Parser(tokens, dialect).parseProgram(), error: null };
  } catch (e) {
    if (e instanceof ParseFailure) return { program: null, error: e.error };
    throw e;
  }
}

class Parser {
  private idx = 0;

  constructor(private readonly tokens: Token[], private readonly dialect: Dialect) {}

  private pos(): Pos {
    return this.peek().pos;
  }

  private fail(message: string, pos: Pos = this.pos()): never {
    throw new ParseFailure({ message, line: pos.line, col: pos.col, phase: 'parse' });
  }

  private peek(n = 0): Token {
    return this.tokens[Math.min(this.idx + n, this.tokens.length - 1)] as Token;
  }

  private isEof(): boolean {
    return this.peek().t === 'eof';
  }

  private next(): Token {
    const t = this.peek();
    if (!this.isEof()) this.idx++;
    return t;
  }

  private at(v: string): boolean {
    return this.peek().v === v;
  }

  private eat(v: string): boolean {
    if (this.at(v)) {
      this.next();
      return true;
    }
    return false;
  }

  private expect(v: string): Token {
    if (!this.at(v)) {
      this.fail(`「${v}」が必要です（見つかったのは「${this.peek().v}」）`);
    }
    return this.next();
  }

  private expectIdent(): string {
    const t = this.peek();
    if (t.t !== 'ident') this.fail(`名前が必要です（見つかったのは「${t.v}」）`);
    this.next();
    return t.v;
  }

  /** Collect tokens up to a delimiter, tracking nesting. */
  private collect(delims: Set<string>, extraStop?: (t: Token) => boolean): Token[] {
    const out: Token[] = [];
    let depth = 0;
    let guard = 0;
    while (!this.isEof() && guard++ < 400) {
      const t = this.peek();
      if (depth === 0 && (delims.has(t.v) || extraStop?.(t))) break;
      if (t.v === '<' || t.v === '[' || t.v === '(') depth++;
      else if (t.v === '>' || t.v === ']' || t.v === ')') {
        if (depth === 0) break;
        depth--;
      }
      out.push(this.next());
    }
    return out;
  }

  parseProgram(): Program {
    const statements: Stmt[] = [];
    let guard = 0;
    while (!this.isEof() && guard++ < 4000) {
      if (this.at(';')) {
        this.next();
        continue;
      }
      // package / import / use declarations are documentation in this subset.
      if (this.at('package') || this.at('import') || this.at('use')) {
        while (!this.isEof() && !this.at(';')) this.next();
        this.eat(';');
        continue;
      }
      if (this.at('impl')) {
        statements.push(this.parseImpl(this.pos()));
        continue;
      }
      if (this.isClassStart()) {
        statements.push(this.parseClass(this.pos()));
        continue;
      }
      if (this.at('fn') || (this.at('pub') && this.peek(1).v === 'fn')) {
        statements.push(this.parseFn(this.pos()));
        continue;
      }
      const before = this.idx;
      statements.push(this.parseStatement());
      if (this.idx === before) this.next(); // never spin forever
    }
    return { statements };
  }

  private isClassStart(): boolean {
    if (CLASS_WORDS.has(this.peek().v)) return true;
    let i = this.idx;
    while (i < this.tokens.length && MODIFIERS.has(this.tokens[i]!.v)) i++;
    const t = this.tokens[i];
    return !!t && (CLASS_WORDS.has(t.v) || t.v === 'class');
  }

  private skipModifiers(): string[] {
    const out: string[] = [];
    while (!this.isEof() && MODIFIERS.has(this.peek().v)) out.push(this.next().v);
    return out;
  }

  private parseImpl(pos: Pos): Stmt {
    this.expect('impl');
    // `impl Display for Foo` -> use Foo. Generic params are skipped.
    const head = this.collect(new Set(['{']));
    let name = head.filter((t) => t.t === 'ident' && !MODIFIERS.has(t.v)).pop()?.v ?? 'Self';
    if (head.some((t) => t.v === 'for')) {
      name = head[head.findIndex((t) => t.v === 'for') + 1]?.v ?? name;
    }
    this.expect('{');
    const methods = this.parseClassMembers(name, 'class');
    this.expect('}');
    return {
      k: 'class',
      pos,
      def: { name, superName: null, methods, fields: [], variants: [], kind: 'class', pos },
    };
  }

  private parseClass(pos: Pos): Stmt {
    const mods = this.skipModifiers();
    if (this.at('non')) {
      this.next();
      this.eat('-');
      this.eat('sealed');
    }
    const kindWord = this.peek().v;
    if (!CLASS_WORDS.has(kindWord)) this.fail('class / interface / enum / record / struct が必要です');
    this.next();
    const kind = kindWord as ClassDef['kind'];
    const name = this.expectIdent();
    let superName: string | null = null;
    const fields: FieldDef[] = [];
    if (this.eat('extends') || this.eat(':')) superName = this.expectIdent();
    if (this.eat('implements') || this.eat('permits')) {
      while (!this.isEof() && !this.at('{') && !this.at(';')) this.next();
    }
    if (this.at('(')) {
      // record header: record Point(double x, double y) { }
      const params = this.parseParams();
      for (const p of params) fields.push({ name: p.name, init: null });
    }
    let methods: MethodDef[] = [];
    let variants: string[] = [];
    if (this.at('{')) {
      this.next();
      methods = this.parseClassMembers(name, kind);
      fields.push(...this.pendingFields.splice(0));
      if (kind === 'record' && !methods.some((m) => m.name === 'constructor')) {
        // record components become fields; synthesise the canonical constructor.
        methods.push({
          name: 'constructor',
          params: fields.map((x) => ({ name: x.name })),
          body: fields.map((x) => ({
            k: 'expr',
            pos,
            expr: {
              k: 'assign',
              pos,
              op: '=',
              target: { k: 'member', pos, obj: { k: 'this', pos }, name: x.name },
              value: { k: 'ident', pos, name: x.name },
            },
          } satisfies Stmt)),
          isStatic: false,
          pos,
        });
      }
      this.expect('}');
    } else {
      // enum Body { A, B, C } without a body
      while (!this.isEof() && !this.at(';')) this.next();
      this.eat(';');
    }
    // Bare enum variants are collected inside parseClassMembers.
    variants = this.pendingVariants.splice(0);
    void mods;
    return {
      k: 'class',
      pos,
      def: { name, superName, methods, fields, variants, kind, pos },
    };
  }

  private pendingVariants: string[] = [];

  private parseClassMembers(className: string, kind: ClassDef['kind']): MethodDef[] {
    const methods: MethodDef[] = [];
    let guard = 0;
    while (!this.isEof() && !this.at('}') && guard++ < 800) {
      if (this.at(';')) {
        this.next();
        continue;
      }
      // enum variant list: A, B, C
      if (kind === 'enum' && this.peek().t === 'ident' &&
          (this.peek(1).v === ',' || this.peek(1).v === ';' || this.peek(1).v === '}')) {
        this.pendingVariants.push(this.next().v);
        while (this.eat(',')) {
          if (this.peek().t === 'ident') this.pendingVariants.push(this.next().v);
        }
        this.eat(';');
        continue;
      }
      const pos = this.pos();
      const memberMods = this.skipModifiers();
      if (this.at('fn')) {
        const f = this.parseFn(pos);
        if (f.k === 'fn') methods.push({ name: f.name, params: f.params, body: f.body, isStatic: memberMods.includes('static'), pos });
        continue;
      }
      const prefix = this.collect(new Set(['(', '=', ';', ',', '{', '}']));
      if (prefix.length === 0) {
        if (this.at('}')) break;
        this.next();
        continue;
      }
      const name = this.nameFromPrefix(prefix);
      if (this.at('(')) {
        const params = this.parseParams();
        // Skip return type (`-> f64`, `throws X`) up to the body.
        while (!this.isEof() && !this.at('{') && !this.at(';')) this.next();
        let body: Stmt[] | null = null;
        if (this.at('{')) {
          this.next();
          body = this.parseBlockBody();
          this.expect('}');
        } else {
          this.eat(';');
        }
        methods.push({
          name: name === className ? 'constructor' : name,
          params,
          body,
          isStatic: memberMods.includes('static') || prefix.some((t) => t.v === 'static'),
          pos,
        });
        continue;
      }
      if (this.at('=')) {
        this.next();
        const init = this.parseExpression();
        this.eat(';');
        methods.push({ name, params: [], body: [{ k: 'return', expr: init, pos }], isStatic: true, pos });
        continue;
      }
      if (prefix.length > 0) this.pendingFields.push({ name, init: null });
      this.eat(';');
      this.eat(',');
    }
    return methods;
  }

  private pendingFields: FieldDef[] = [];

  private nameFromPrefix(prefix: Token[]): string {
    const colon = prefix.findIndex((t) => t.v === ':');
    if (colon > 0) return prefix[colon - 1]!.v;
    const idents = prefix.filter((t) => t.t === 'ident' && !MODIFIERS.has(t.v));
    return idents[idents.length - 1]?.v ?? '_';
  }

  private parseParams(): Param[] {
    this.expect('(');
    const params: Param[] = [];
    let guard = 0;
    while (!this.isEof() && !this.at(')') && guard++ < 100) {
      const chunk = this.collect(new Set([',', ')']));
      if (chunk.length > 0) params.push({ name: this.nameFromPrefix(chunk) });
      if (!this.eat(',')) break;
    }
    this.expect(')');
    return params;
  }

  private parseFn(pos: Pos): Stmt {
    this.skipModifiers();
    this.expect('fn');
    const name = this.expectIdent();
    // Skip generic params like <T: Ord>
    if (this.at('<')) {
      let depth = 0;
      do {
        const v = this.next().v;
        if (v === '<') depth++;
        else if (v === '>') depth--;
      } while (!this.isEof() && depth > 0);
    }
    const params = this.parseParams();
    while (!this.isEof() && !this.at('{') && !this.at(';') && !this.at('}')) this.next();
    let body: Stmt[] = [];
    if (this.at('{')) {
      this.next();
      body = this.parseBlockBody();
      this.expect('}');
    } else this.eat(';');
    return { k: 'fn', name, params, body, pos };
  }

  private parseBlockBody(): Stmt[] {
    const out: Stmt[] = [];
    let guard = 0;
    while (!this.isEof() && !this.at('}') && guard++ < 2000) {
      if (this.at(';')) {
        this.next();
        continue;
      }
      const before = this.idx;
      out.push(this.parseStatement());
      if (this.idx === before) this.next();
    }
    return out;
  }

  private parseBlock(): Stmt {
    const pos = this.pos();
    this.expect('{');
    const body = this.parseBlockBody();
    this.expect('}');
    return { k: 'block', body, pos };
  }

  private looksLikeDeclaration(): boolean {
    const a = this.peek();
    const b = this.peek(1);
    if (a.t !== 'ident') return false;
    if (STATEMENT_WORDS.has(a.v) && a.v !== 'let') return false;
    if (a.v === 'let' || a.v === 'const' || a.v === 'var') return true;
    if (MODIFIERS.has(a.v)) return true;
    if (this.isClassStart()) return false;
    return b.t === 'ident' || b.v === '[' || b.v === '<' || b.v === '::';
  }

  private parseStatement(): Stmt {
    const pos = this.pos();
    if (this.at('{')) return this.parseBlock();
    if (this.at('if')) return this.parseIf(pos);
    if (this.at('while') || this.at('loop')) return this.parseWhile(pos);
    if (this.at('for')) return this.parseFor(pos);
    if (this.at('return')) {
      this.next();
      const expr = this.at(';') || this.at('}') ? null : this.parseExpression();
      this.eat(';');
      return { k: 'return', expr, pos };
    }
    if (this.at('break')) {
      this.next();
      this.eat(';');
      return { k: 'break', pos };
    }
    if (this.at('continue')) {
      this.next();
      this.eat(';');
      return { k: 'continue', pos };
    }
    if (this.isClassStart()) return this.parseClass(pos);
    if (this.at('fn') || (this.at('pub') && this.peek(1).v === 'fn')) return this.parseFn(pos);
    if (this.at('impl')) return this.parseImpl(pos);
    if (this.looksLikeDeclaration()) return this.parseVarDecl();
    const expr = this.parseExpression();
    this.eat(';');
    return { k: 'expr', expr, pos };
  }

  private parseVarDecl(): Stmt {
    const pos = this.pos();
    const prefix = this.collect(new Set(['=', ';', ')', ',', '{', '(']));
    const name = this.nameFromPrefix(prefix);
    const typeWords = prefix.filter((t) => t.t === 'ident' && !MODIFIERS.has(t.v) && t.v !== name);
    const typeName = typeWords.map((t) => t.v).join(' ');
    const isRust = this.dialect === 'rust';
    const immutableKeyword = prefix.some((t) => t.v === 'final' || t.v === 'const');
    const mutable = !immutableKeyword && (!isRust || prefix.some((t) => t.v === 'mut'));
    let init: Expr | null = null;
    if (this.eat('=')) init = this.parseExpression();
    this.eat(';');
    return { k: 'var', name, mutable, typeName, init, pos };
  }

  private parseIf(pos: Pos): Stmt {
    this.expect('if');
    const paren = this.eat('(');
    const cond = this.parseExpression();
    if (paren) this.expect(')');
    const then = this.statementAsList();
    let otherwise: Stmt[] = [];
    if (this.at('else')) {
      this.next();
      otherwise = this.statementAsList();
    }
    return { k: 'if', cond, then, otherwise, pos };
  }

  private parseWhile(pos: Pos): Stmt {
    const isLoop = this.at('loop');
    this.next();
    let cond: Expr = { k: 'bool', value: true, pos };
    if (!isLoop) {
      const paren = this.eat('(');
      cond = this.parseExpression();
      if (paren) this.expect(')');
    }
    const body = this.statementAsList();
    return { k: 'while', cond, body, pos };
  }

  private parseFor(pos: Pos): Stmt {
    this.expect('for');
    if (this.eat('(')) {
      // Java: for (int i = 0; i < n; i++)   or   for (Planet p : list)
      const colonAt = this.lookAheadFor(':');
      if (colonAt >= 0) {
        const prefix = this.collect(new Set([':']));
        const name = this.nameFromPrefix(prefix);
        this.expect(':');
        const iterable = this.parseExpression();
        this.expect(')');
        return { k: 'forIn', name, iterable, body: this.statementAsList(), pos };
      }
      let init: Stmt | null = null;
      if (!this.at(';')) init = this.looksLikeDeclaration() ? this.parseVarDecl() : this.parseSimpleExprStmt();
      // A declaration / simple expression statement may already have consumed
      // its own semicolon; only consume one if it is still present.
      this.eat(';');
      const cond = this.at(';') ? null : this.parseExpression();
      this.expect(';');
      const update = this.at(')') ? null : this.parseExpression();
      this.expect(')');
      return { k: 'for', init, cond, update, body: this.statementAsList(), pos };
    }
    // Rust: for i in 0..n { } / for x in list { }
    const name = this.expectIdent();
    this.expect('in');
    const iterable = this.parseExpression();
    return { k: 'forIn', name, iterable, body: this.statementAsList(), pos };
  }

  private lookAheadFor(v: string): number {
    let depth = 0;
    for (let i = this.idx; i < Math.min(this.tokens.length, this.idx + 80); i++) {
      const t = this.tokens[i]!;
      if (t.v === '(' || t.v === '[') depth++;
      else if (t.v === ')' || t.v === ']') {
        if (depth === 0) return -1;
        depth--;
      } else if (t.v === v && depth === 0) return i;
      else if (t.v === '{') return -1;
    }
    return -1;
  }

  private parseSimpleExprStmt(): Stmt {
    const pos = this.pos();
    const expr = this.parseExpression();
    this.eat(';');
    return { k: 'expr', expr, pos };
  }

  private statementAsList(): Stmt[] {
    if (this.at('{')) {
      this.next();
      const body = this.parseBlockBody();
      this.expect('}');
      return body;
    }
    return [this.parseStatement()];
  }

  // ---- expressions -------------------------------------------------------

  private parseExpression(): Expr {
    return this.parseAssignment();
  }

  private parseAssignment(): Expr {
    const left = this.parseOr();
    if (ASSIGN_OPS.has(this.peek().v)) {
      const op = this.next().v;
      const right = this.parseAssignment();
      return { k: 'assign', target: left, op, value: right, pos: left.pos };
    }
    if (this.dialect === 'java' && this.at('?')) {
      this.next();
      const then = this.parseAssignment();
      this.expect(':');
      const otherwise = this.parseAssignment();
      return { k: 'ternary', cond: left, then, otherwise, pos: left.pos };
    }
    return left;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.at('||')) {
      this.next();
      left = { k: 'binary', op: '||', left, right: this.parseAnd(), pos: left.pos };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEquality();
    while (this.at('&&')) {
      this.next();
      left = { k: 'binary', op: '&&', left, right: this.parseEquality(), pos: left.pos };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseComparison();
    while (this.at('==') || this.at('!=')) {
      const op = this.next().v;
      left = { k: 'binary', op, left, right: this.parseComparison(), pos: left.pos };
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseTerm();
    while (['<', '>', '<=', '>='].includes(this.peek().v)) {
      const op = this.next().v;
      left = { k: 'binary', op, left, right: this.parseTerm(), pos: left.pos };
    }
    return left;
  }

  private parseTerm(): Expr {
    let left = this.parseFactor();
    while (this.at('+') || this.at('-')) {
      const op = this.next().v;
      left = { k: 'binary', op, left, right: this.parseFactor(), pos: left.pos };
    }
    return left;
  }

  private parseFactor(): Expr {
    let left = this.parseUnary();
    while (this.at('*') || this.at('/') || this.at('%')) {
      const op = this.next().v;
      left = { k: 'binary', op, left, right: this.parseUnary(), pos: left.pos };
    }
    return left;
  }

  private parseUnary(): Expr {
    const pos = this.pos();
    if (['!', '-', '+', '&', '~'].includes(this.peek().v)) {
      const op = this.next().v;
      if (op === '&' && this.at('mut')) this.next();
      return { k: 'unary', op, arg: this.parseUnary(), pos };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    let guard = 0;
    while (guard++ < 300) {
      if (this.at('.')) {
        this.next();
        const name = this.expectIdent();
        expr = { k: 'member', obj: expr, name, pos: expr.pos };
      } else if (this.at('::')) {
        this.next();
        const name = this.expectIdent();
        expr = { k: 'member', obj: expr, name, pos: expr.pos };
      } else if (this.at('[')) {
        this.next();
        const index = this.parseExpression();
        this.expect(']');
        expr = { k: 'index', obj: expr, index, pos: expr.pos };
      } else if (this.at('(')) {
        expr = { k: 'call', callee: expr, args: this.parseArgs(), macro: false, pos: expr.pos };
      } else if (this.at('!') && ['(', '[', '{'].includes(this.peek(1).v)) {
        this.next();
        expr = { k: 'call', callee: expr, args: this.parseArgs(), macro: true, pos: expr.pos };
      } else if (this.at('..')) {
        this.next();
        const to = this.parseOr();
        expr = { k: 'range', from: expr, to, pos: expr.pos };
      } else if (this.at('++') || this.at('--')) {
        const op = this.next().v as '++' | '--';
        expr = { k: 'postfix', op, arg: expr, pos: expr.pos };
      } else break;
    }
    return expr;
  }

  private parseArgs(): Expr[] {
    // Rust macros use (), [] or {} as delimiters: println!(), vec![], todo!{}
    const open = this.peek().v;
    const close = open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : ')';
    if (open !== '(' && open !== '[' && open !== '{') this.fail('引数リストが必要です');
    this.next();
    const args: Expr[] = [];
    let guard = 0;
    while (!this.isEof() && !this.at(close) && guard++ < 100) {
      args.push(this.parseExpression());
      if (!this.eat(',')) break;
    }
    this.expect(close);
    return args;
  }

  private parsePrimary(): Expr {
    const pos = this.pos();
    const t = this.peek();
    if (t.t === 'num') {
      this.next();
      return { k: 'num', value: t.num ?? 0, isInt: t.isInt ?? true, pos };
    }
    if (t.t === 'str') {
      this.next();
      return { k: 'str', value: t.v, pos };
    }
    if (this.at('(')) {
      this.next();
      const e = this.parseExpression();
      this.expect(')');
      return e;
    }
    if (this.at('[') || this.at('{')) {
      const close = this.at('[') ? ']' : '}';
      this.next();
      const items: Expr[] = [];
      let guard = 0;
      while (!this.isEof() && !this.at(close) && guard++ < 200) {
        items.push(this.parseExpression());
        if (!this.eat(',')) break;
      }
      this.expect(close);
      return { k: 'array', items, pos };
    }
    if (t.t === 'ident') {
      const name = t.v;
      this.next();
      if (name === 'true' || name === 'false') return { k: 'bool', value: name === 'true', pos };
      if (name === 'null' || name === 'None' || name === 'Nothing') return { k: 'null', pos };
      if (name === 'this' || name === 'self') return { k: 'this', pos };
      if (name === 'super') return { k: 'super', pos };
      if (name === 'new') {
        const className = this.expectIdent();
        return { k: 'new', className, args: this.parseArgs(), pos };
      }
      if (name === 'match') return this.parseMatch(pos);
      return { k: 'ident', name, pos };
    }
    if (t.t === 'eof') this.fail('式が途中で終わっています');
    this.fail(`式を解釈できません: 「${t.v}」`);
  }

  private parseMatch(pos: Pos): Expr {
    const subject = this.parseExpression();
    this.expect('{');
    const arms: MatchArm[] = [];
    let guard = 0;
    while (!this.isEof() && !this.at('}') && guard++ < 100) {
      const armPos = this.pos();
      const pattern = this.parsePattern();
      this.expect('=>');
      let body: Expr;
      if (this.at('{')) {
        this.next();
        body = { k: 'blockExpr', statements: this.parseBlockBody(), pos: armPos };
        this.expect('}');
      } else body = this.parseExpression();
      arms.push({ pattern, body, pos: armPos });
      if (!this.eat(',')) {
        // Rust permits a block arm without a trailing comma.
        if (body.k !== 'blockExpr' && !this.at('}')) this.eat(',');
      }
    }
    this.expect('}');
    return { k: 'match', subject, arms, pos };
  }

  private parsePattern(): MatchPattern {
    const t = this.peek();
    if (t.v === '_') {
      this.next();
      return { k: 'wildcard' };
    }
    if (t.t === 'num' || t.t === 'str' || t.v === 'true' || t.v === 'false') {
      this.next();
      return { k: 'literal', text: t.v };
    }
    if (t.t === 'ident') {
      const name = this.next().v;
      const isVariant = /^[A-Z]/.test(name) || ['Some', 'Ok', 'Err', 'None'].includes(name);
      if (this.at('(')) {
        this.next();
        const inner = this.parsePattern();
        this.expect(')');
        return { k: 'variant', tag: name, inner };
      }
      if (isVariant) return { k: 'variant', tag: name, inner: null };
      return { k: 'binding', name };
    }
    this.fail(`パターンを解釈できません: 「${t.v}」`);
  }
}

