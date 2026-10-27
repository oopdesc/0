import { tokenize, type Token } from './lexer';
import type {
  Block, CatchClause, ClassDecl, CompilationUnit, Expr, FieldDecl, MethodDecl, Param, Pos, Stmt, SwitchCase, TypeRef,
} from './ast';

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(message);
  }
}

const PRIMITIVES = new Set(['int', 'long', 'double', 'float', 'char', 'byte', 'short', 'boolean', 'void']);
const MODIFIERS = new Set([
  'public', 'private', 'protected', 'static', 'final', 'abstract', 'native', 'synchronized', 'transient',
  'volatile', 'strictfp', 'default', 'sealed', 'non',
]);

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=']);

export class Parser {
  private toks: Token[];
  private p = 0;
  private typeNames = new Set<string>();
  /** 教材コードで既知の型名（キャスト判定の補助） */
  private known = new Set<string>([
    'String', 'Integer', 'Double', 'Boolean', 'Long', 'Character', 'List', 'ArrayList', 'Map', 'HashMap', 'Set',
    'HashSet', 'Optional', 'Object', 'Exception', 'RuntimeException', 'IllegalArgumentException', 'Number',
    'CharSequence', 'Comparable', 'Math', 'System', 'Arrays', 'Collections', 'Collectors', 'Stream', 'StringBuilder',
  ]);

  constructor(src: string) {
    this.toks = tokenize(src);
  }

  /* ── helpers ─────────────────────────────────────── */
  private peek(k = 0): Token {
    return this.toks[Math.min(this.p + k, this.toks.length - 1)];
  }
  private at(v: string): boolean {
    const t = this.peek();
    return (t.kind === 'op' || t.kind === 'ident') && t.value === v;
  }
  private atAny(...vs: string[]): boolean {
    return vs.some((v) => this.at(v));
  }
  private pos(t = this.peek()): Pos {
    return { line: t.line, col: t.col };
  }
  private next(): Token {
    return this.toks[this.p++];
  }
  private eat(v: string): Token {
    if (!this.at(v)) {
      const t = this.peek();
      throw new ParseError(`'${v}' が来るはずの位置に '${t.value || 'ファイル末尾'}' があります`, t.line, t.col);
    }
    return this.next();
  }
  private accept(v: string): boolean {
    if (this.at(v)) {
      this.next();
      return true;
    }
    return false;
  }
  private ident(): string {
    const t = this.peek();
    if (t.kind !== 'ident') throw new ParseError(`名前が来るはずの位置に '${t.value || 'ファイル末尾'}' があります`, t.line, t.col);
    this.next();
    return t.value;
  }
  private error(msg: string, t = this.peek()): never {
    throw new ParseError(msg, t.line, t.col);
  }

  /* ── compilation unit ────────────────────────────── */
  parseUnit(): CompilationUnit {
    let packageName: string | null = null;
    const imports: string[] = [];
    while (this.at('package') || this.at('import')) {
      if (this.accept('package')) {
        packageName = this.qualifiedName();
        this.eat(';');
      } else {
        this.eat('import');
        this.accept('static');
        let name = this.ident();
        while (this.at('.') && this.peek(1).kind === 'ident') {
          this.next();
          name += '.' + this.ident();
        }
        if (this.at('.')) {
          this.next();
          this.eat('*');
          name += '.*';
        }
        imports.push(name);
        this.eat(';');
      }
    }
    const classes: ClassDecl[] = [];
    while (!this.at('') && this.peek().kind !== 'eof') {
      if (this.at(';')) {
        this.next();
        continue;
      }
      classes.push(this.parseClass());
    }
    return { packageName, imports, classes };
  }

  private qualifiedName(): string {
    let name = this.ident();
    while (this.at('.')) {
      this.next();
      name += '.' + this.ident();
    }
    return name;
  }

  parseClass(): ClassDecl {
    const mods = this.modifiers();
    let kind: ClassDecl['kind'] = 'class';
    if (this.accept('interface')) kind = 'interface';
    else if (this.accept('enum')) kind = 'enum';
    else if (this.accept('record')) kind = 'record';
    else this.eat('class');
    this.accept('@');
    const nameTok = this.peek();
    const name = this.ident();
    this.typeNames.add(name);
    this.known.add(name);
    const typeParams = this.typeParams();
    const recordComponents: { type: TypeRef; name: string }[] = [];
    if (kind === 'record' && this.at('(')) {
      this.next();
      while (!this.at(')')) {
        const type = this.parseType();
        const n = this.ident();
        recordComponents.push({ type, name: n });
        if (!this.accept(',')) break;
      }
      this.eat(')');
    }
    let superName: string | null = null;
    const interfaces: string[] = [];
    if (this.accept('extends')) {
      superName = this.typeNameText();
      while (this.accept(',')) interfaces.push(this.typeNameText());
    }
    if (this.accept('implements')) {
      interfaces.push(this.typeNameText());
      while (this.accept(',')) interfaces.push(this.typeNameText());
    }
    // sealed の許可リストは意味解析で使うので読み飛ばさずに保持する
    let permits: string[] | undefined;
    if (this.accept('permits')) {
      permits = [this.typeNameText()];
      while (this.accept(',')) permits.push(this.typeNameText());
    }
    this.eat('{');
    const fields: FieldDecl[] = [];
    const methods: MethodDecl[] = [];
    const ctors: MethodDecl[] = [];
    const enumConstants: { name: string; args: Expr[] }[] = [];
    const nested: ClassDecl[] = [];

    if (kind === 'enum') {
      while (!this.at(';') && !this.at('}')) {
        const cname = this.ident();
        const args: Expr[] = [];
        if (this.at('(')) {
          this.next();
          while (!this.at(')')) {
            args.push(this.parseExpr());
            if (!this.accept(',')) break;
          }
          this.eat(')');
        }
        if (this.at('{')) {
          // 定数固有の本体は教材では扱わない
          this.skipBraces();
        }
        enumConstants.push({ name: cname, args });
        if (!this.accept(',')) break;
      }
      this.accept(';');
    }

    while (!this.at('}')) {
      if (this.peek().kind === 'eof') this.error('クラス本体が閉じていません');
      if (this.accept(';')) continue;
      if (this.at('static') && this.peek(1).value === '{') {
        this.next();
        this.skipBraces();
        continue;
      }
      if (this.at('{')) {
        this.skipBraces();
        continue;
      }
      const mmods = this.modifiers();
      if (this.atAny('class', 'interface', 'enum', 'record')) {
        nested.push(this.parseClass());
        continue;
      }
      const startPos = this.pos();
      // コンストラクタ: クラス名と同じ名前で、直後が '('
      if (this.peek().value === name && this.peek(1).value === '(') {
        this.next();
        const params = this.params();
        const throwsList: string[] = [];
        if (this.accept('throws')) {
          throwsList.push(this.typeNameText());
          while (this.accept(',')) throwsList.push(this.typeNameText());
        }
        const body = this.block();
        ctors.push({
          mods: mmods, name, ret: { name: 'void', dims: 0, pos: startPos }, params, body, throwsList,
          pos: startPos, isCtor: true,
        });
        continue;
      }
      const type = this.parseType();
      const memberName = this.ident();
      if (this.at('(')) {
        const params = this.params();
        const throwsList: string[] = [];
        if (this.accept('throws')) {
          throwsList.push(this.typeNameText());
          while (this.accept(',')) throwsList.push(this.typeNameText());
        }
        let body: Stmt | null = null;
        if (this.at('{')) body = this.block();
        else this.eat(';');
        methods.push({ mods: mmods, name: memberName, ret: type, params, body, throwsList, pos: startPos, isCtor: false });
      } else {
        let init: Expr | null = null;
        if (this.accept('=')) init = this.parseInitializer(type);
        while (this.accept('[')) {
          this.eat(']');
          type.dims++;
        }
        this.eat(';');
        fields.push({ mods: mmods, type, name: memberName, init, pos: startPos });
      }
    }
    this.eat('}');
    void nameTok;

    // コンストラクタ: 名前が class 名と一致し、戻り値型が無いもの。
    // parseType は識別子 1 つを型として読むため、`Point(...)` は上の分岐で
    // 戻り値型 Point・メソッド名 ( の位置で失敗する。ここでは事前判定で回収する。
    return {
      kind, mods, name, typeParams, superName, interfaces, permits, fields, methods, ctors, enumConstants, recordComponents,
      nested, pos: { line: nameTok.line, col: nameTok.col },
    };
  }

  /** constructor を含むメンバ解析（parseClass 内から呼ぶ） */
  private params(): Param[] {
    this.eat('(');
    const out: Param[] = [];
    while (!this.at(')')) {
      this.modifiers();
      const type = this.parseType();
      let varargs = false;
      if (this.accept('...')) {
        varargs = true;
        type.dims++;
      }
      const name = this.ident();
      while (this.accept('[')) this.eat(']');
      out.push({ type, name, varargs });
      if (!this.accept(',')) break;
    }
    this.eat(')');
    return out;
  }

  private typeParams(): string[] {
    if (!this.at('<')) return [];
    const save = this.p;
    try {
      this.next();
      const out: string[] = [];
      while (!this.at('>')) {
        out.push(this.ident());
        if (this.accept('extends')) this.typeNameText();
        if (!this.accept(',')) break;
      }
      this.eat('>');
      return out;
    } catch {
      this.p = save;
      return [];
    }
  }

  private typeNameText(): string {
    let n = this.ident();
    while (this.at('.')) {
      this.next();
      n += '.' + this.ident();
    }
    if (this.at('<')) this.skipAngles();
    return n;
  }

  private skipAngles(): void {
    let depth = 0;
    do {
      if (this.at('<')) depth++;
      if (this.at('>')) depth--;
      if (this.at('>>')) {
        depth -= 2;
      }
      if (this.at('>>>')) {
        depth -= 3;
      }
      this.next();
    } while (depth > 0 && this.peek().kind !== 'eof');
  }

  private modifiers(): string[] {
    const out: string[] = [];
    for (;;) {
      if (this.at('@')) {
        this.next();
        this.ident();
        while (this.at('.')) {
          this.next();
          this.ident();
        }
        if (this.at('(')) {
          let depth = 0;
          do {
            if (this.at('(')) depth++;
            if (this.at(')')) depth--;
            this.next();
          } while (depth > 0 && this.peek().kind !== 'eof');
        }
        continue;
      }
      if (this.at('@')) {
        // アノテーションは意味を持たないので読み飛ばす
        this.next();
        this.ident();
        while (this.at('.')) {
          this.next();
          this.ident();
        }
        if (this.at('(')) {
          let depth = 0;
          do {
            if (this.at('(')) depth++;
            if (this.at(')')) depth--;
            this.next();
          } while (depth > 0 && this.peek().kind !== 'eof');
        }
        continue;
      }
      const v = this.peek().value;
      if (!MODIFIERS.has(v)) break;
      // `default` は switch のラベルでもある。次が識別子（型名）なら修飾子。
      if (v === 'default' && this.peek(1).kind !== 'ident') break;
      if (v === 'non' && this.peek(1).value !== '-') break;
      this.next();
      out.push(v);
      if (v === 'non') {
        this.accept('-');
        this.accept('sealed');
      }
    }
    return out;
  }

  parseType(): TypeRef {
    const pos = this.pos();
    let name: string;
    if (PRIMITIVES.has(this.peek().value)) name = this.next().value;
    else name = this.qualifiedTypeName();
    let args: TypeRef[] | undefined;
    if (this.at('<')) {
      this.next();
      args = [];
      while (!this.at('>')) {
        args.push(this.parseType());
        if (!this.accept(',')) break;
        if (this.at('>>')) break;
      }
      if (this.at('>>')) {
        // `>>` を 2 つの `>` として扱う
        this.toks[this.p] = { ...this.toks[this.p], value: '>' };
      } else this.eat('>');
    }
    let dims = 0;
    while (this.at('[') && this.peek(1).value === ']') {
      this.next();
      this.next();
      dims++;
    }
    if (this.at('...')) {
      this.next();
      dims++;
    }
    return { name, dims, args, pos };
  }

  private qualifiedTypeName(): string {
    let n = this.ident();
    this.known.add(n);
    while (this.at('.') && this.peek(1).kind === 'ident') {
      this.next();
      n += '.' + this.ident();
    }
    return n;
  }

  private skipBraces(): void {
    let depth = 0;
    do {
      if (this.at('{')) depth++;
      else if (this.at('}')) depth--;
      this.next();
    } while (depth > 0 && this.peek().kind !== 'eof');
  }

  /* ── statements ──────────────────────────────────── */
  block(): Block {
    const pos = this.pos();
    this.eat('{');
    const body: Stmt[] = [];
    while (!this.at('}')) {
      if (this.peek().kind === 'eof') this.error('ブロックが閉じていません');
      body.push(this.statement());
    }
    this.eat('}');
    return { t: 'block', body, pos };
  }

  statement(): Stmt {
    const pos = this.pos();
    const t = this.peek();

    if (t.value === '{') return this.block();
    if (t.value === ';') {
      this.next();
      return { t: 'empty', pos };
    }
    if (t.value === 'if') {
      this.next();
      this.eat('(');
      const test = this.parseExpr();
      this.eat(')');
      const then = this.statement();
      const other = this.accept('else') ? this.statement() : null;
      return { t: 'if', test, then, other, pos };
    }
    if (t.value === 'while') {
      this.next();
      this.eat('(');
      const test = this.parseExpr();
      this.eat(')');
      return { t: 'while', test, body: this.statement(), pos };
    }
    if (t.value === 'do') {
      this.next();
      const body = this.statement();
      this.eat('while');
      this.eat('(');
      const test = this.parseExpr();
      this.eat(')');
      this.eat(';');
      return { t: 'do', body, test, pos };
    }
    if (t.value === 'for') {
      this.next();
      this.eat('(');
      // 拡張 for か判定する
      const save = this.p;
      let isForEach = false;
      try {
        this.modifiers();
        this.parseType();
        if (this.peek().kind === 'ident' && this.peek(1).value === ':') isForEach = true;
      } catch {
        /* 通常の for */
      }
      this.p = save;
      if (isForEach) {
        this.modifiers();
        const type = this.parseType();
        const name = this.ident();
        this.eat(':');
        const iter = this.parseExpr();
        this.eat(')');
        return { t: 'foreach', type, name, iter, body: this.statement(), pos };
      }
      const init: Stmt[] = [];
      if (!this.at(';')) {
        init.push(this.forInit());
        while (this.accept(',')) init.push(this.forInit());
      }
      this.eat(';');
      const test = this.at(';') ? null : this.parseExpr();
      this.eat(';');
      const update: Expr[] = [];
      if (!this.at(')')) {
        update.push(this.parseExpr());
        while (this.accept(',')) update.push(this.parseExpr());
      }
      this.eat(')');
      return { t: 'for', init, test, update, body: this.statement(), pos };
    }
    if (t.value === 'switch') return this.switchStmt();
    if (t.value === 'return') {
      this.next();
      const value = this.at(';') ? null : this.parseExpr();
      this.eat(';');
      return { t: 'return', value, pos };
    }
    if (t.value === 'break') {
      this.next();
      const label = this.peek().kind === 'ident' ? this.ident() : null;
      this.eat(';');
      return { t: 'break', label, pos };
    }
    if (t.value === 'continue') {
      this.next();
      const label = this.peek().kind === 'ident' ? this.ident() : null;
      this.eat(';');
      return { t: 'continue', label, pos };
    }
    if (t.value === 'throw') {
      this.next();
      const value = this.parseExpr();
      this.eat(';');
      return { t: 'throw', value, pos };
    }
    if (t.value === 'try') return this.tryStmt();
    if (t.value === 'synchronized') {
      this.next();
      this.eat('(');
      this.parseExpr();
      this.eat(')');
      return this.block();
    }
    if (t.value === 'assert') {
      this.next();
      this.parseExpr();
      if (this.accept(':')) this.parseExpr();
      this.eat(';');
      return { t: 'empty', pos };
    }
    if (t.value === 'yield') {
      this.next();
      const value = this.at(';') ? null : this.parseExpr();
      this.eat(';');
      return value ? { t: 'expr', expr: value, pos } : { t: 'empty', pos };
    }
    if (t.kind === 'ident' && this.peek(1).value === ':' && !PRIMITIVES.has(t.value)) {
      const label = this.ident();
      this.eat(':');
      return { t: 'labeled', label, body: this.statement(), pos };
    }

    // ローカル変数宣言か式文か
    if (this.looksLikeVarDecl()) {
      const mods = this.modifiers();
      const type = this.parseType();
      const name = this.ident();
      while (this.accept('[')) this.eat(']');
      const init = this.accept('=') ? this.parseInitializer(type) : null;
      this.eat(';');
      return { t: 'var', type, name, init, pos, finalVar: mods.includes('final') };
    }
    const expr = this.parseExpr();
    this.eat(';');
    return { t: 'expr', expr, pos };
  }

  /** 変数初期化子。配列の `{...}` 初期化にも対応する。 */
  private parseInitializer(type: TypeRef): Expr {
    if (this.at('{') && type.dims > 0) {
      const pos = this.pos();
      this.next();
      const items = this.arrayItems(type.dims, type.name);
      this.eat('}');
      return { t: 'new', typeName: type.name, args: [], arrayInit: items, initDims: type.dims, pos };
    }
    return this.parseExpr();
  }

  /**
   * 配列初期化子の要素列。`{` の直後から `}` の手前までを読む。
   * depth が 2 以上なら、要素が `{` のときは入れ子の初期化子として読む
   * （`int[][] g = {{1, 2}, {3}};` のような多次元の省略記法）。
   */
  private arrayItems(depth: number, typeName: string): Expr[] {
    const items: Expr[] = [];
    while (!this.at('}') && this.peek().kind !== 'eof') {
      if (this.at('{') && depth > 1) {
        const pos = this.pos();
        this.next();
        const inner = this.arrayItems(depth - 1, typeName);
        this.eat('}');
        items.push({ t: 'new', typeName, args: [], arrayInit: inner, initDims: depth - 1, pos });
      } else {
        items.push(this.parseExpr());
      }
      if (!this.accept(',')) break;
    }
    return items;
  }

  private forInit(): Stmt {
    const pos = this.pos();
    if (this.looksLikeVarDecl()) {
      this.modifiers();
      const type = this.parseType();
      const name = this.ident();
      const init = this.accept('=') ? this.parseInitializer(type) : null;
      return { t: 'var', type, name, init, pos };
    }
    return { t: 'expr', expr: this.parseExpr(), pos };
  }

  private looksLikeVarDecl(): boolean {
    const t = this.peek();
    if (MODIFIERS.has(t.value)) return true;
    if (PRIMITIVES.has(t.value)) return true;
    if (t.kind !== 'ident') return false;
    // Ident Ident / java.util.List<...> xs / Ident[] Ident
    let k = 1;
    while (this.peek(k).value === '.' && this.peek(k + 1).kind === 'ident') k += 2;
    if (this.peek(k).value === '<') {
      // ジェネリクスを読み飛ばして次の識別子を見る
      let depth = 1;
      k += 1;
      while (k < 200) {
        const v = this.peek(k).value;
        if (v === '<') depth++;
        else if (v === '>') {
          depth--;
          if (depth === 0) {
            k++;
            break;
          }
        } else if (v === '>>') {
          depth -= 2;
          if (depth <= 0) {
            k++;
            break;
          }
        } else if (this.peek(k).kind === 'eof') return false;
        k++;
      }
    }
    while (this.peek(k).value === '[' && this.peek(k + 1).value === ']') k += 2;
    return this.peek(k).kind === 'ident';
  }

  private switchStmt(): Stmt {
    const pos = this.pos();
    this.eat('switch');
    this.eat('(');
    const subject = this.parseExpr();
    this.eat(')');
    this.eat('{');
    const cases: SwitchCase[] = [];
    let arrow = false;
    while (!this.at('}')) {
      const cpos = this.pos();
      const labels: Expr[] = [];
      let isDefault = false;
      if (this.accept('default')) isDefault = true;
      else {
        this.eat('case');
        labels.push(this.parseExpr());
        while (this.accept(',')) labels.push(this.parseExpr());
      }
      if (this.accept('->')) {
        arrow = true;
        const body: Stmt[] = [];
        if (this.at('{')) body.push(this.block());
        else if (this.at('throw')) body.push(this.statement());
        else {
          const vpos = this.pos();
          const e = this.parseExpr();
          this.eat(';');
          body.push({ t: 'expr', expr: e, pos: vpos });
        }
        cases.push({ labels: isDefault ? null : labels, body, arrow: true, pos: cpos });
      } else {
        this.eat(':');
        const body: Stmt[] = [];
        while (!this.at('case') && !this.at('default') && !this.at('}')) body.push(this.statement());
        cases.push({ labels: isDefault ? null : labels, body, arrow: false, pos: cpos });
      }
    }
    this.eat('}');
    return { t: 'switch', subject, cases, pos, arrow };
  }

  private tryStmt(): Stmt {
    const pos = this.pos();
    this.eat('try');
    this.accept('(');
    if (this.peek(-1).value === '(') {
      // try-with-resources: 教材では本体のみ実行する
      while (!this.at(')')) this.next();
      this.eat(')');
    }
    const body = this.block();
    const catches: CatchClause[] = [];
    while (this.at('catch')) {
      const cpos = this.pos();
      this.next();
      this.eat('(');
      const type = this.parseType();
      const name = this.ident();
      this.eat(')');
      catches.push({ type, name, body: this.block(), pos: cpos });
    }
    const fin = this.accept('finally') ? this.block() : null;
    if (!catches.length && !fin) this.error('try には catch か finally が必要です');
    return { t: 'try', body, catches, fin, pos };
  }

  /* ── expressions ─────────────────────────────────── */
  parseExpr(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const left = this.ternary();
    const t = this.peek();
    if (t.kind === 'op' && ASSIGN_OPS.has(t.value)) {
      const op = t.value;
      const pos = this.pos();
      this.next();
      const value = this.assignment();
      return { t: 'assign', op, target: left, value, pos };
    }
    return left;
  }

  private ternary(): Expr {
    const cond = this.binary(0);
    if (this.at('?')) {
      const pos = this.pos();
      this.next();
      const then = this.parseExpr();
      this.eat(':');
      const other = this.ternary();
      return { t: 'cond', test: cond, then, other, pos };
    }
    return cond;
  }

  private static LEVELS: string[][] = [
    ['||'],
    ['&&'],
    ['|'],
    ['^'],
    ['&'],
    ['==', '!='],
    ['<', '>', '<=', '>=', 'instanceof'],
    ['<<', '>>', '>>>'],
    ['+', '-'],
    ['*', '/', '%'],
  ];

  private binary(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.unary();
    let left = this.binary(level + 1);
    for (;;) {
      const t = this.peek();
      if (t.kind === 'op' && Parser.LEVELS[level].includes(t.value) && t.value !== 'instanceof') {
        const pos = this.pos();
        this.next();
        const right = this.binary(level + 1);
        left = { t: 'binary', op: t.value, left, right, pos };
        continue;
      }
      if (t.value === 'instanceof') {
        const pos = this.pos();
        this.next();
        const type = this.parseType();
        left = { t: 'instanceof', expr: left, type, pos };
        continue;
      }
      return left;
    }
  }

  private unary(): Expr {
    const t = this.peek();
    const pos = this.pos();
    if (t.kind === 'op' && ['+', '-', '!', '~'].includes(t.value)) {
      this.next();
      return { t: 'unary', op: t.value, expr: this.unary(), pos };
    }
    if (t.value === '++' || t.value === '--') {
      this.next();
      return { t: 'prefix', op: t.value as '++' | '--', expr: this.unary(), pos };
    }
    if (t.value === '(' && this.looksLikeCast()) {
      this.next();
      const type = this.parseType();
      this.eat(')');
      const inner = this.unary();
      // ラムダの引数リスト `(a, b) ->` はここでは扱わない（先に lambda 判定）
      return { t: 'cast', type, expr: inner, pos };
    }
    return this.postfix();
  }

  private looksLikeCast(): boolean {
    const t1 = this.peek(1);
    if (t1.kind !== 'ident' && !PRIMITIVES.has(t1.value)) return false;
    if (PRIMITIVES.has(t1.value)) {
      // (int) x は確実にキャスト
      return true;
    }
    // (Type) x : 次の次のトークンが ) で、その後に式が続く
    let k = 2;
    if (this.peek(k).value === '<') {
      let depth = 0;
      while (k < 200) {
        const v = this.peek(k).value;
        if (v === '<') depth++;
        if (v === '>') {
          depth--;
          if (depth === 0) {
            k++;
            break;
          }
        }
        if (v === '>>') {
          depth -= 2;
          if (depth <= 0) {
            k++;
            break;
          }
        }
        k++;
      }
    }
    while (this.peek(k).value === '[' && this.peek(k + 1).value === ']') k += 2;
    if (this.peek(k).value !== ')') return false;
    const after = this.peek(k + 1);
    const isTypeLike = /^[A-Z]/.test(t1.value) || this.known.has(t1.value);
    if (!isTypeLike) return false;
    return (
      after.kind === 'ident' ||
      after.kind === 'num' ||
      after.kind === 'str' ||
      after.kind === 'char' ||
      ['(', '!', '~'].includes(after.value)
    );
  }

  private postfix(): Expr {
    let e = this.primary();
    for (;;) {
      const pos = this.pos();
      if (this.at('.')) {
        this.next();
        if (this.at('<')) {
          this.skipAngles();
        }
        if (this.at('new')) {
          const inner = this.newExpr();
          e = inner;
          continue;
        }
        const name = this.ident();
        if (this.at('(')) {
          const args = this.args();
          e = { t: 'call', target: e, name, args, pos };
        } else {
          e = { t: 'field', target: e, name, pos };
        }
        continue;
      }
      if (this.at('[')) {
        this.next();
        const index = this.parseExpr();
        this.eat(']');
        e = { t: 'index', target: e, index, pos };
        continue;
      }
      if (this.at('++') || this.at('--')) {
        const op = this.next().value as '++' | '--';
        e = { t: 'postfix', op, expr: e, pos };
        continue;
      }
      if (this.at('::')) {
        this.next();
        const name = this.ident();
        // 型名::メソッド（String::length）と、式::メソッド（System.out::println）の両方
        const owner = e.t === 'name' ? e.name : '<expr>';
        e = e.t === 'name'
          ? { t: 'methodref', owner, name, pos }
          : { t: 'methodref', owner, name, receiver: e, pos };
        continue;
      }
      return e;
    }
  }

  private args(): Expr[] {
    this.eat('(');
    const out: Expr[] = [];
    while (!this.at(')')) {
      out.push(this.parseExpr());
      if (!this.accept(',')) break;
    }
    this.eat(')');
    return out;
  }

  private newExpr(): Expr {
    const pos = this.pos();
    this.eat('new');
    const typeName = PRIMITIVES.has(this.peek().value) ? this.next().value : this.qualifiedTypeName();
    if (this.at('<')) this.skipAngles();
    if (this.at('[')) {
      this.next();
      let first: Expr | null = null;
      if (!this.at(']')) first = this.parseExpr();
      this.eat(']');
      if (first === null && this.at('{')) {
        this.next();
        const items = this.arrayItems(1, typeName);
        this.eat('}');
        return { t: 'new', typeName, args: [], arrayInit: items, initDims: 1, pos };
      }
      const dims: Expr[] = first ? [first] : [null as unknown as Expr];
      while (this.at('[')) {
        this.next();
        const d = this.at(']') ? (null as unknown as Expr) : this.parseExpr();
        this.eat(']');
        dims.push(d);
      }
      // `new int[][]{{1}, {2, 3}}` のような多次元の初期化子（全次元が空 [] のときだけ）
      if (this.at('{') && dims.every((d) => d === null)) {
        this.next();
        const items = this.arrayItems(dims.length, typeName);
        this.eat('}');
        return { t: 'new', typeName, args: [], arrayInit: items, initDims: dims.length, pos };
      }
      return { t: 'new', typeName, args: [], arrayDims: dims, pos };
    }
    if (this.at('{')) {
      this.next();
      const items = this.arrayItems(1, typeName);
      this.eat('}');
      return { t: 'new', typeName, args: [], arrayInit: items, initDims: 1, pos };
    }
    const args = this.args();
    if (this.at('{')) {
      // 匿名クラス本体: 教材では中身を無視してインスタンスだけ作る
      this.skipBraces();
    }
    return { t: 'new', typeName, args, pos };
  }

  private primary(): Expr {
    const t = this.peek();
    const pos = this.pos();

    if (t.kind === 'num') {
      this.next();
      const raw = t.value;
      const suffix = raw.slice(-1);
      const body = /[lLfFdD]/.test(suffix) ? raw.slice(0, -1) : raw;
      if (suffix === 'L' || suffix === 'l') return { t: 'lit', kind: 'long', value: body, pos };
      if (suffix === 'f' || suffix === 'F') return { t: 'lit', kind: 'float', value: body, pos };
      if (suffix === 'd' || suffix === 'D') return { t: 'lit', kind: 'double', value: body, pos };
      if (/[.eE]/.test(body) && !/^0[xX]/.test(body)) return { t: 'lit', kind: 'double', value: body, pos };
      return { t: 'lit', kind: 'int', value: body, pos };
    }
    if (t.kind === 'str') {
      this.next();
      return { t: 'lit', kind: 'string', value: t.value, pos };
    }
    if (t.kind === 'char') {
      this.next();
      return { t: 'lit', kind: 'char', value: t.value, pos };
    }
    if (t.value === 'true' || t.value === 'false') {
      this.next();
      return { t: 'lit', kind: 'boolean', value: t.value === 'true', pos };
    }
    if (t.value === 'null') {
      this.next();
      return { t: 'lit', kind: 'null', value: null, pos };
    }
    if (t.value === 'this') {
      this.next();
      if (this.at('(')) {
        const args = this.args();
        return { t: 'call', target: { t: 'this', pos }, name: 'this', args, pos };
      }
      return { t: 'this', pos };
    }
    if (t.value === 'super') {
      this.next();
      if (this.at('(')) {
        const args = this.args();
        return { t: 'call', target: { t: 'super', pos }, name: 'super', args, pos };
      }
      if (this.at('.')) {
        this.next();
        const name = this.ident();
        if (this.at('(')) {
          const args = this.args();
          return { t: 'call', target: { t: 'super', pos }, name, args, pos };
        }
        return { t: 'field', target: { t: 'super', pos }, name, pos };
      }
      return { t: 'super', pos };
    }
    if (t.value === 'new') return this.newExpr();
    if (t.value === '(') {
      // ラムダの可能性
      const lam = this.tryLambda();
      if (lam) return lam;
      this.next();
      const e = this.parseExpr();
      this.eat(')');
      return e;
    }
    if (t.kind === 'ident' && this.peek(1).value === '->') {
      this.next();
      this.next();
      const params = [t.value];
      const body = this.at('{') ? this.block() : this.parseExpr();
      return { t: 'lambda', params, body, pos };
    }
    if (t.kind === 'ident') {
      this.next();
      if (this.at('(')) {
        const args = this.args();
        return { t: 'call', target: null, name: t.value, args, pos };
      }
      return { t: 'name', name: t.value, pos };
    }
    if (PRIMITIVES.has(t.value) && this.peek(1).value === '.') {
      this.next();
      this.next();
      const name = this.ident();
      const args = this.at('(') ? this.args() : [];
      return { t: 'call', target: { t: 'name', name: t.value, pos }, name, args, pos };
    }
    this.error(`式が予想された位置に '${t.value || 'ファイル末尾'}' があります`);
  }

  private tryLambda(): Expr | null {
    const pos = this.pos();
    const save = this.p;
    try {
      this.eat('(');
      const params: string[] = [];
      if (!this.at(')')) {
        // 型付き / 型無しの引数
        for (;;) {
          if (this.peek().kind === 'ident' && (this.peek(1).value === ',' || this.peek(1).value === ')')) {
            params.push(this.ident());
          } else {
            this.parseType();
            params.push(this.ident());
          }
          if (!this.accept(',')) break;
        }
      }
      this.eat(')');
      if (!this.at('->')) {
        this.p = save;
        return null;
      }
      this.next();
      const body = this.at('{') ? this.block() : this.parseExpr();
      return { t: 'lambda', params, body, pos };
    } catch {
      this.p = save;
      return null;
    }
  }
}

/** `public class Main { public static void main(String[] args) { <body> } }` に包む。 */
export function wrapBody(body: string): string {
  // body モードでも import だけは書けるようにする（教材で `import java.util.*;` を
  // 見せたいときに、学習者のコードがそのまま JDK でコンパイルできるようにするため）。
  const imports: string[] = [];
  const rest: string[] = [];
  for (const l of body.split('\n')) {
    if (/^\s*import\s+[\w.*]+\s*;\s*$/.test(l)) imports.push(l.trim());
    else rest.push(l);
  }
  const indented = rest.map((l) => (l.trim() ? '    ' + l : l)).join('\n');
  const head = imports.length ? imports.join('\n') + '\n' : '';
  return `${head}public class Main {\n  public static void main(String[] args) {\n${indented}\n  }\n}\n`;
}

export function parseJava(src: string): CompilationUnit {
  const p = new Parser(src);
  return p.parseUnit();
}

export function parseJavaBody(body: string): CompilationUnit {
  return parseJava(wrapBody(body));
}

export function parseStatementList(src: string): Stmt[] {
  const p = new Parser(`class X { void m() { ${src} } }`);
  const unit = p.parseUnit();
  const cls = unit.classes[0];
  const m = cls.methods[0];
  return m.body && m.body.t === 'block' ? m.body.body : [];
}
