/** Java サブセットの AST。位置情報はエラー表示と追跡表示に使う。 */

export interface Pos {
  line: number;
  col: number;
}

export interface TypeRef {
  name: string; // int, String, int[], List<Integer> ...
  dims: number;
  args?: TypeRef[];
  pos: Pos;
}

export type Expr =
  | { t: 'lit'; kind: 'int' | 'long' | 'double' | 'float' | 'char' | 'string' | 'boolean' | 'null'; value: string | number | boolean | null; pos: Pos }
  | { t: 'name'; name: string; pos: Pos }
  | { t: 'this'; pos: Pos }
  | { t: 'super'; pos: Pos }
  | { t: 'field'; target: Expr; name: string; pos: Pos }
  | { t: 'index'; target: Expr; index: Expr; pos: Pos }
  | { t: 'call'; target: Expr | null; name: string; args: Expr[]; pos: Pos }
  | { t: 'new'; typeName: string; typeArgs?: TypeRef[]; args: Expr[]; arrayInit?: Expr[]; initDims?: number; arrayDims?: Expr[]; pos: Pos }
  | { t: 'unary'; op: string; expr: Expr; pos: Pos }
  | { t: 'binary'; op: string; left: Expr; right: Expr; pos: Pos }
  | { t: 'assign'; op: string; target: Expr; value: Expr; pos: Pos }
  | { t: 'cond'; test: Expr; then: Expr; other: Expr; pos: Pos }
  | { t: 'cast'; type: TypeRef; expr: Expr; pos: Pos }
  | { t: 'instanceof'; expr: Expr; type: TypeRef; pos: Pos }
  | { t: 'postfix'; op: '++' | '--'; expr: Expr; pos: Pos }
  | { t: 'prefix'; op: '++' | '--'; expr: Expr; pos: Pos }
  | { t: 'lambda'; params: string[]; body: Expr | Block; pos: Pos }
  | { t: 'methodref'; owner: string; name: string; receiver?: Expr; pos: Pos };

export type Stmt =
  | { t: 'var'; type: TypeRef; name: string; init: Expr | null; pos: Pos; finalVar?: boolean }
  | { t: 'expr'; expr: Expr; pos: Pos }
  | { t: 'block'; body: Stmt[]; pos: Pos }
  | { t: 'if'; test: Expr; then: Stmt; other: Stmt | null; pos: Pos }
  | { t: 'while'; test: Expr; body: Stmt; pos: Pos }
  | { t: 'do'; body: Stmt; test: Expr; pos: Pos }
  | { t: 'for'; init: Stmt[]; test: Expr | null; update: Expr[]; body: Stmt; pos: Pos }
  | { t: 'foreach'; type: TypeRef; name: string; iter: Expr; body: Stmt; pos: Pos }
  | { t: 'switch'; subject: Expr; cases: SwitchCase[]; pos: Pos; arrow: boolean }
  | { t: 'break'; label: string | null; pos: Pos }
  | { t: 'continue'; label: string | null; pos: Pos }
  | { t: 'return'; value: Expr | null; pos: Pos }
  | { t: 'throw'; value: Expr; pos: Pos }
  | { t: 'try'; body: Stmt; catches: CatchClause[]; fin: Stmt | null; pos: Pos }
  | { t: 'labeled'; label: string; body: Stmt; pos: Pos }
  | { t: 'empty'; pos: Pos };

export interface Block {
  t: 'block';
  body: Stmt[];
  pos: Pos;
}

export interface SwitchCase {
  /** null は default */
  labels: Expr[] | null;
  body: Stmt[];
  arrow: boolean;
  pos: Pos;
}

export interface CatchClause {
  type: TypeRef;
  name: string;
  body: Stmt;
  pos: Pos;
}

export interface Param {
  type: TypeRef;
  name: string;
  varargs?: boolean;
}

export interface FieldDecl {
  mods: string[];
  type: TypeRef;
  name: string;
  init: Expr | null;
  pos: Pos;
}

export interface MethodDecl {
  mods: string[];
  name: string;
  ret: TypeRef;
  params: Param[];
  body: Stmt | null;
  throwsList: string[];
  pos: Pos;
  isCtor: boolean;
}

export interface ClassDecl {
  kind: 'class' | 'interface' | 'enum' | 'record';
  mods: string[];
  name: string;
  typeParams: string[];
  superName: string | null;
  interfaces: string[];
  /** sealed の許可リスト（permits A, B） */
  permits?: string[];
  fields: FieldDecl[];
  methods: MethodDecl[];
  ctors: MethodDecl[];
  enumConstants: { name: string; args: Expr[] }[];
  recordComponents: { type: TypeRef; name: string }[];
  nested: ClassDecl[];
  pos: Pos;
}

export interface CompilationUnit {
  packageName: string | null;
  imports: string[];
  classes: ClassDecl[];
}
