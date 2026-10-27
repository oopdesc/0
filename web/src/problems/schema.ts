/**
 * Problem schema.
 *
 * Everything the learner sees is data. No problem-specific UI code exists;
 * the player renders whatever this schema describes. That keeps the dataset
 * auditable, testable and machine-checkable against real compilers.
 *
 * Honesty contract (see README / HANDOFF.md):
 *   - `expected` is NEVER authored by hand as "what I think it does".
 *     It is produced by `tools/verify-problems.mjs`, which runs every
 *     executable problem through real `javac`/`java` (JDK 21) or `rustc`
 *     (stable) and compares the observed result with the declared one.
 *   - A problem that cannot be executed in the browser says so in
 *     `execution`. Nothing pretends to run code it does not run.
 */

export type Language = 'java' | 'rust';

/** Requirement 10: mistake taxonomy. Drives error-lab grouping and retries. */
export type MisconceptionClass =
  | 'concept'          // 概念の誤解
  | 'evaluation-order' // 処理順の誤読
  | 'value-vs-reference' // 値と参照の混同
  | 'compile-vs-runtime' // compile-time / runtime の混同
  | 'type'             // 型の誤解
  | 'boundary'         // 境界値
  | 'api'              // API 仕様
  | 'override-overload' // override / overload
  | 'scope'            // スコープ
  | 'exception'        // exception
  | 'ownership'        // ownership
  | 'borrowing'        // borrowing
  | 'move'             // move
  | 'lifetime'         // lifetime
  | 'option-result'    // Option / Result
  | 'iterator'         // iterator
  | 'reading'          // 単純な読み落とし
  | 'transfer';        // 転移の失敗

export const MISCONCEPTION_LABEL: Record<MisconceptionClass, string> = {
  concept: '概念の誤解',
  'evaluation-order': '処理順の誤読',
  'value-vs-reference': '値と参照の混同',
  'compile-vs-runtime': 'コンパイル時 / 実行時の混同',
  type: '型の誤解',
  boundary: '境界値',
  api: 'API 仕様',
  'override-overload': 'override / overload',
  scope: 'スコープ',
  exception: '例外',
  ownership: '所有権',
  borrowing: '借用',
  move: 'move',
  lifetime: 'ライフタイム',
  'option-result': 'Option / Result',
  iterator: 'iterator',
  reading: '読み落とし',
  transfer: '転移',
};

export type QuestionType =
  | 'predict-output'   // 出力予測
  | 'compile'          // コンパイル可否
  | 'runtime-error'    // 実行時例外予測
  | 'trace'            // 処理順追跡
  | 'variable-trace'   // 変数値追跡
  | 'call-trace'       // 呼出し追跡
  | 'override-choice'  // override 選択
  | 'bug-find'         // bug 発見
  | 'minimal-fix'      // 最小修正
  | 'fill-blank'       // 穴埋め
  | 'order'            // 並べ替え
  | 'boundary'         // 境界値選択
  | 'api-meaning'      // API の意味
  | 'implement'        // 自力実装
  | 'debug-trace'      // デバッガ追跡
  | 'concept';         // 概念問

export const QUESTION_LABEL: Record<QuestionType, string> = {
  'predict-output': '出力予測',
  compile: 'コンパイル可否',
  'runtime-error': '実行時例外',
  trace: '処理順追跡',
  'variable-trace': '変数値追跡',
  'call-trace': '呼出し追跡',
  'override-choice': 'override 選択',
  'bug-find': 'bug 発見',
  'minimal-fix': '最小修正',
  'fill-blank': '穴埋め',
  order: '並べ替え',
  boundary: '境界値',
  'api-meaning': 'API の意味',
  implement: '自力実装',
  'debug-trace': 'デバッガ追跡',
  concept: '概念問',
};

/** What the browser is actually able to do with this problem. */
export type ExecutionKind =
  | 'browser-java'   // compiled into the TeaVM bundle: real Java runs in the browser
  | 'jvm-verified'   // expected output verified by real javac/java
  | 'rust-verified'  // expected output verified by real rustc
  | 'teaching-runtime' // runs in the documented subset interpreter
  | 'compile-checked'   // compiler verdict verified, no run
  | 'reading';           // no code run at all

export interface Expected {
  /** Console lines, exactly as observed by the real toolchain. */
  output?: string[];
  /** Compiler verdict for `compile` questions. */
  compiles?: boolean;
  /** Compiler error code / first line, for `compile` questions. */
  compileError?: string;
  /** Runtime exception type, for `runtime-error` questions. */
  runtimeError?: string;
  /** Body count when the code drives the cosmos model. */
  bodyCount?: number;
  /** Free-form value the learner must produce (trace answers etc). */
  value?: string;
  /** Which toolchain produced this expectation. */
  verifiedBy: string;
}

export interface PredictionSpec {
  /** Short instruction shown before the answer area. */
  text: string;
  /** Optional multiple choice. Free text is always available too. */
  options?: string[];
}

export interface VariantSpec {
  /** Surface change applied to the base code to make a transfer problem. */
  id: string;
  label: string;
  /** Substitution map, e.g. { '7': '9', '2': '3' }. */
  replace?: Record<string, string>;
  /** Replaced expected output, verified separately. */
  expected: Expected;
  /** One-line rule that must still hold. */
  rule?: string;
}

export interface Problem {
  id: string;
  language: Language;
  topic: string;
  level: 1 | 2 | 3;
  prerequisite?: string[];
  questionType: QuestionType;
  prompt: string;
  /** Code shown to the learner. May contain `____` blanks. */
  code?: string;
  /** Editable starting point for fill/order/implement/minimal-fix. */
  starter?: string;
  /** Verified correct code. */
  solution?: string;
  prediction: PredictionSpec;
  /** Correct answer, compared after normalisation. */
  answer: string;
  answerKind: 'text' | 'option' | 'code' | 'order';
  /** Order answers: the exact accepted sequence (for `order`). */
  orderAnswer?: string[];
  /** Lines the learner must reorder (display order is deterministic). */
  orderLines?: string[];
  expected?: Expected;
  explanation: string;
  /** The wrong belief this problem is designed to break. */
  misconception: string;
  misconceptionClass: MisconceptionClass;
  /** The single short rule saved for later retrieval. */
  oneLinePatch: string;
  /** Staged hints: where to look, which rule, partial reveal. */
  hints: string[];
  variants?: VariantSpec[];
  /** Id of the transfer problem shown after a correct answer. */
  transfer?: string;
  /** Days until the next retrieval practice. */
  reviewInterval: number;
  execution: ExecutionKind;
  /** Teaching-runtime dialect if `execution` is `teaching-runtime`. */
  runtime?: 'java' | 'rust';
  source: string;
  version: number;
}

export interface TopicMeta {
  id: string;
  language: Language | 'bridge';
  name: string;
  kicker: string;
  summary: string;
  order: number;
}

/** Normalise learner answers: trim, unify width/digits, collapse whitespace. */
export function normaliseAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isCorrectAnswer(given: string, expected: string): boolean {
  return normaliseAnswer(given) === normaliseAnswer(expected);
}

/** Order answers compare as sequences of normalised lines. */
export function isCorrectOrder(given: string[], expected: string[]): boolean {
  if (given.length !== expected.length) return false;
  return given.every((line, i) => normaliseAnswer(line) === normaliseAnswer(expected[i]!));
}

/** Deterministic shuffle: reproducible, and never the already-correct order. */
export function shuffleLines(lines: string[], salt: string): string[] {
  let seed = 2166136261 >>> 0;
  for (const ch of salt) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  if (out.length > 1 && out.join('\n') === lines.join('\n')) {
    [out[0], out[1]] = [out[1] as string, out[0] as string];
  }
  return out;
}

/**
 * Deterministic variant generator (requirement 14).
 * One concept -> several surface-different siblings with verified outputs.
 * Pure function of (problem, salt): the same salt always yields the same set.
 */
export function makeVariants(problem: Problem, salt: string): Problem[] {
  const out: Problem[] = [];
  for (const v of problem.variants ?? []) {
    const code = v.replace
      ? Object.entries(v.replace).reduce(
          (acc, [from, to]) => acc.split(from).join(to),
          problem.code ?? '',
        )
      : problem.code;
    out.push({
      ...problem,
      id: `${problem.id}:${v.id}`,
      prompt: `${problem.prompt}\n\n変形 ${v.label}。同じ規則が适用できるか。`,
      code,
      solution: problem.solution,
      expected: v.expected,
      oneLinePatch: v.rule ?? problem.oneLinePatch,
      variants: undefined,
    });
  }
  return out.map((p, i) => ({ ...p, id: `${p.id}-${hashSalt(salt, i)}` }));
}

function hashSalt(salt: string, i: number): string {
  let h = 2166136261 >>> 0;
  for (const ch of `${salt}${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36).slice(0, 5);
}
