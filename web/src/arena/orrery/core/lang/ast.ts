/** AST for the ORRERY teaching runtime (a documented SUBSET of Java / Rust). */
export interface Pos {
  line: number;
  col: number;
}

export type Expr =
  | { k: 'num'; value: number; isInt: boolean; pos: Pos }
  | { k: 'str'; value: string; pos: Pos }
  | { k: 'bool'; value: boolean; pos: Pos }
  | { k: 'null'; pos: Pos }
  | { k: 'ident'; name: string; pos: Pos }
  | { k: 'this'; pos: Pos }
  | { k: 'super'; pos: Pos }
  | { k: 'binary'; op: string; left: Expr; right: Expr; pos: Pos }
  | { k: 'unary'; op: string; arg: Expr; pos: Pos }
  | { k: 'postfix'; op: '++' | '--'; arg: Expr; pos: Pos }
  | { k: 'assign'; target: Expr; op: string; value: Expr; pos: Pos }
  | { k: 'call'; callee: Expr; args: Expr[]; macro: boolean; pos: Pos }
  | { k: 'member'; obj: Expr; name: string; pos: Pos }
  | { k: 'index'; obj: Expr; index: Expr; pos: Pos }
  | { k: 'array'; items: Expr[]; pos: Pos }
  | { k: 'range'; from: Expr; to: Expr; pos: Pos }
  | { k: 'new'; className: string; args: Expr[]; pos: Pos }
  | { k: 'match'; subject: Expr; arms: MatchArm[]; pos: Pos }
  | { k: 'blockExpr'; statements: Stmt[]; pos: Pos }
  | { k: 'ternary'; cond: Expr; then: Expr; otherwise: Expr; pos: Pos };

export type MatchPattern =
  | { k: 'wildcard' }
  | { k: 'literal'; text: string }
  | { k: 'binding'; name: string }
  | { k: 'variant'; tag: string; inner: MatchPattern | null };

export interface MatchArm {
  pattern: MatchPattern;
  body: Expr;
  pos: Pos;
}

export interface Param {
  name: string;
}

export interface MethodDef {
  name: string;
  params: Param[];
  body: Stmt[] | null;
  isStatic: boolean;
  pos: Pos;
}

export interface FieldDef {
  name: string;
  init: Expr | null;
}

export interface ClassDef {
  name: string;
  superName: string | null;
  methods: MethodDef[];
  fields: FieldDef[];
  variants: string[];
  kind: 'class' | 'interface' | 'record' | 'enum' | 'struct';
  pos: Pos;
}

export type Stmt =
  | { k: 'var'; name: string; mutable: boolean; typeName: string; init: Expr | null; pos: Pos }
  | { k: 'expr'; expr: Expr; pos: Pos }
  | { k: 'if'; cond: Expr; then: Stmt[]; otherwise: Stmt[]; pos: Pos }
  | { k: 'while'; cond: Expr; body: Stmt[]; pos: Pos }
  | { k: 'for'; init: Stmt | null; cond: Expr | null; update: Expr | null; body: Stmt[]; pos: Pos }
  | { k: 'forIn'; name: string; iterable: Expr; body: Stmt[]; pos: Pos }
  | { k: 'block'; body: Stmt[]; pos: Pos }
  | { k: 'return'; expr: Expr | null; pos: Pos }
  | { k: 'break'; pos: Pos }
  | { k: 'continue'; pos: Pos }
  | { k: 'fn'; name: string; params: Param[]; body: Stmt[]; pos: Pos }
  | { k: 'class'; def: ClassDef; pos: Pos };

export interface Program {
  statements: Stmt[];
}

export type Dialect = 'java' | 'rust';

export interface LangError {
  message: string;
  line: number;
  col: number;
  phase: 'lex' | 'parse' | 'runtime' | 'borrow';
}

export interface TraceStep {
  index: number;
  line: number;
  label: string;
  vars: Array<[string, string]>;
  outputCount: number;
  bodyCount: number;
}

export interface RunResult {
  ok: boolean;
  errors: LangError[];
  output: string[];
  trace: TraceStep[];
  /** Number of celestial bodies after execution. */
  bodyCount: number;
  /** Wall-clock milliseconds spent interpreting. */
  elapsedMs: number;
  /** Final top-level variable values, formatted for the debugger panel. */
  locals: Array<[string, string]>;
  dialect: Dialect;
}
