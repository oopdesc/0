import type { CauseId, Lang } from './types';

export interface CauseInfo {
  id: CauseId;
  label: string;
  lang: Lang | 'both';
  /** 同じ原因が続いたときに戻る教材の方向 */
  drill: string;
}

export const CAUSES: CauseInfo[] = [
  { id: 'concept', label: '概念そのものの誤解', lang: 'both', drill: '前提の定義を 1 つずつ確かめる問題' },
  { id: 'order-of-operations', label: '処理順の誤読', lang: 'both', drill: '評価順を 1 ステップずつ追う問題' },
  { id: 'value-vs-reference', label: '値と参照の混同', lang: 'both', drill: '参照の共有とコピーを見分ける問題' },
  { id: 'compile-vs-runtime', label: 'コンパイル時と実行時の混同', lang: 'both', drill: '「いつ決まるか」を問う問題' },
  { id: 'type', label: '型の誤解', lang: 'both', drill: '型が決まる位置を問う問題' },
  { id: 'boundary', label: '境界値の誤り', lang: 'both', drill: '0 と length のあいだを問う問題' },
  { id: 'api', label: 'API 仕様の誤解', lang: 'both', drill: '戻り値と副作用を問う問題' },
  { id: 'override-overload', label: 'override と overload', lang: 'java', drill: 'どちらが選ばれるかを問う問題' },
  { id: 'scope', label: 'スコープ', lang: 'both', drill: '名前がどの範囲で見えるかを問う問題' },
  { id: 'exception', label: '例外の流れ', lang: 'both', drill: 'finally と伝播順を問う問題' },
  { id: 'ownership', label: '所有権', lang: 'rust', drill: '値の持ち主が誰かを問う問題' },
  { id: 'borrowing', label: '借用（borrow）', lang: 'rust', drill: '同時に何個まで借りられるかを問う問題' },
  { id: 'move', label: 'move', lang: 'rust', drill: 'move 後に元の binding を使えるかを問う問題' },
  { id: 'lifetime', label: 'lifetime', lang: 'rust', drill: '参照が値より長生きしないかを見る問題' },
  { id: 'option-result', label: 'Option / Result', lang: 'rust', drill: 'None / Err の扱いを問う問題' },
  { id: 'iterator', label: 'iterator', lang: 'rust', drill: '消費と遅延評価を問う問題' },
  { id: 'misread', label: '単純な読み落とし', lang: 'both', drill: '同じ問題を条件を変えて読み直す' },
  { id: 'mutability', label: 'mutability', lang: 'both', drill: '変更できる範囲を問う問題' },
  { id: 'copy-vs-clone', label: 'Copy と clone', lang: 'rust', drill: 'どの型が暗黙に複製されるかを問う問題' },
  { id: 'string-vs-str', label: 'String と &str', lang: 'rust', drill: '所有する文字列と借りた文字列を問う問題' },
  { id: 'integer-overflow', label: '整数の桁あふれ', lang: 'both', drill: '32 bit の上限をまたぐ計算' },
  { id: 'exhaustiveness', label: 'match の網羅性', lang: 'rust', drill: '全パターンを書いたかを問う問題' },
  { id: 'interop', label: '境界（Rust と JS/WASM）', lang: 'rust', drill: '線形メモリの受け渡しを問う問題' },
];

export const CAUSE_BY_ID: Record<string, CauseInfo> = Object.fromEntries(CAUSES.map((c) => [c.id, c]));

export function causeLabel(id: string | undefined): string {
  if (!id) return '未分類';
  return CAUSE_BY_ID[id]?.label ?? id;
}
