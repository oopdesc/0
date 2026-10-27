/**
 * 問題データのスキーマ。
 *
 * 教材は UI コンポーネントに直書きしない。すべてこの型のデータとして持ち、
 * 画面・復習・検証ツール・レポートが同じ 1 つのデータ源を読む。
 */

export type Lang = 'java' | 'rust';

/** 誤答の原因分類。ERROR LAB と復習の選択に使う。 */
export type CauseId =
  | 'concept'
  | 'order-of-operations'
  | 'value-vs-reference'
  | 'compile-vs-runtime'
  | 'type'
  | 'boundary'
  | 'api'
  | 'override-overload'
  | 'scope'
  | 'exception'
  | 'ownership'
  | 'borrowing'
  | 'move'
  | 'lifetime'
  | 'option-result'
  | 'iterator'
  | 'misread'
  | 'mutability'
  | 'copy-vs-clone'
  | 'string-vs-str'
  | 'integer-overflow'
  | 'exhaustiveness'
  | 'interop';

export type ProblemKind =
  | 'predict-output' // 出力予測
  | 'will-compile' // コンパイルできる / できない
  | 'runtime-exception' // どの例外で落ちるか
  | 'evaluate-step' // 途中の値・評価順の追跡
  | 'fill-blank' // 穴埋め
  | 'debug-fix' // バグ発見・最小修正
  | 'parsons' // 行を正しい順序へ
  | 'boundary' // 境界値・条件
  | 'api-meaning' // API・シグネチャの意味
  | 'build-mini' // 小さく自力で書く
  | 'compare'; // Java と Rust の対応・非対応

export const KIND_LABEL: Record<ProblemKind, string> = {
  'predict-output': '出力予測',
  'will-compile': 'コンパイル判定',
  'runtime-exception': '例外予測',
  'evaluate-step': '処理追跡',
  'fill-blank': '穴埋め',
  'debug-fix': '最小修正',
  parsons: '並べ替え',
  boundary: '境界値',
  'api-meaning': 'API 理解',
  'build-mini': '小さく書く',
  compare: '比較',
};

/** 回答方式。どの方式でも「予測 → 確定 → 結果」の同じ流れを通る。 */
export type Answer =
  | {
      mode: 'choice';
      options: { text: string; cause?: CauseId }[];
      correct: number;
      /** 予測を確定する前に見せてはいけない補足（正解の言い換えなど） */
      afterNote?: string;
    }
  | {
      mode: 'blanks';
      /** コード中の ____ を順に埋める。accept は正規化後に完全一致で比較。 */
      blanks: { accept: string[]; label: string }[];
    }
  | {
      mode: 'order';
      /** 正しい順序の行。表示時は決定的にシャッフルする。 */
      lines: string[];
    }
  | {
      mode: 'code';
      starter: string;
      /** 参照解。採点には使わず、結果表示と検証に使う。 */
      reference: string;
      /** 実行して判定できる場合のテスト（Java のみ実行可能） */
      tests?: { input?: string; expectOutput: string[] }[];
      /** 実行できない場合の簡易検査。ラベルは必ず「簡易」と表示する。 */
      lint?: { must?: string[]; mustNot?: string[]; mustMatch?: string[]; minLines?: number };
      /** 自己採点のみ。mastery の確定には使わない。 */
      selfAssessed?: boolean;
    }
  | {
      mode: 'text';
      /** 出力や値の自由記述。正規化して完全一致で判定する。 */
      accept: string[];
      placeholder?: string;
      multiline?: boolean;
    };

export interface VerifiedFixture {
  tool: string;
  version: string;
  verdict: 'ok' | 'compile-error' | 'runtime-error' | 'error';
  stdout: string[];
  /** JDK / rustc が実際に出したメッセージの先頭行 */
  stderr: string[];
  errorCode?: string;
  /** 実行時例外のクラス名（Java） */
  exception?: string;
  /** 実測の所要時間（ミリ秒）。演出ではなく記録用。 */
  elapsedMs?: number;
  /** 検証したソース（ハーネスで包む前の断片ではなく、包んだ後の完全なソース） */
  compiledSource?: string;
  harness?: 'body' | 'unit';
}

/**
 * 教材が主張する「正解」。検証ツールが JDK / rustc の実測と照合し、
 * 一致しない限りビルドを通さない（架空の出力を作らないための仕組み）。
 */
export type Expectation =
  | { kind: 'output'; output: string[] }
  | { kind: 'compile-error'; errorCode: string; messageIncludes?: string }
  | { kind: 'runtime-error'; exception: string; outputBefore?: string[]; messageIncludes?: string }
  | { kind: 'compile-ok-no-run' };

export interface Misconception {
  /** 学習者が持ちやすい誤った信念 */
  belief: string;
  /** なぜそれが自然に感じられるか */
  whyTempting: string;
  /** 実際に起きること */
  correction: string;
  cause: CauseId;
}

export interface Problem {
  id: string;
  lang: Lang;
  family: string;
  concepts: string[];
  title: string;
  level: 1 | 2 | 3 | 4 | 5;
  kind: ProblemKind;
  prompt: string;
  /** 表示するコード。Java の body 形式は class と main の中に置かれる。 */
  code?: string;
  /** コードの前提。バージョン差・ハーネスの説明に使う。 */
  codeNote?: string;
  langVersion?: string;
  answer: Answer;
  /** 検証時にコンパイル・実行するか。false の概念問題では実測しない。 */
  runnable?: boolean;
  /** ハーネスで包む方法。java は body か unit、rust は body か unit。 */
  harness?: 'body' | 'unit';
  /** ブラウザ内の実行エンジンで実行できるか（Java のみ） */
  interactive?: boolean;
  /** ライブ実行を許可する場合の入力（任意） */
  runInput?: string;
  /** 結果の見方 */
  explanation: string;
  /** 誤答選択肢ごとの「なぜ違うか」 */
  optionNotes?: Record<number, string>;
  misconception: Misconception;
  /** 1 行ルール */
  patch: string;
  /** 3 段階ヒント。答えそのものは 3 番目まで出さない。 */
  hints: [string, string, string];
  /** 直後に解く類題 */
  transfer?: string;
  /** 時間を空けた想起で使う別 surface の問題 */
  reviewVariants?: string[];
  estSec?: number;
  tags?: string[];
  /** 検証ツールが照合する期待値 */
  expect?: Expectation;
  /** 穴埋め・並べ替え問題で、検証時に使う完成形のコード（表示は code のまま） */
  verifyCode?: string;
  /** tools/verify-content.mjs が埋める実測結果 */
  verified?: VerifiedFixture;
}

export interface Concept {
  id: string;
  lang: Lang;
  name: string;
  family: string;
  /** 前提概念 */
  prereqs: string[];
  /** 学習者が最後に持ち帰る 1 行 */
  rule: string;
  summary: string;
  /** Java と Rust で対応しない部分の注記 */
  contrast?: string;
}

export interface Family {
  id: string;
  lang: Lang;
  name: string;
  blurb: string;
  order: number;
}

export interface Curriculum {
  families: Family[];
  concepts: Concept[];
  problems: Problem[];
}

/* ── 表示用ラベル ─────────────────────────────────────── */

export const LEVEL_LABEL: Record<number, string> = {
  1: '入門',
  2: '基礎',
  3: '中級',
  4: '応用',
  5: '上級',
};

export const LANG_LABEL: Record<Lang, string> = { java: 'Java', rust: 'Rust' };

export function normalise(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
    .toLowerCase();
}

/** 出力行の比較。末尾の空白と全角半角の揺れだけを吸収する。 */
export function normaliseOutput(lines: string[]): string {
  return normalise(lines.map((l) => l.trimEnd()).join('\n'));
}

export function checkText(given: string, accept: string[]): boolean {
  const g = normalise(given);
  return accept.some((a) => normalise(a) === g);
}
