import { CONCEPTS } from '../academy/content/concepts';

/**
 * Display-only Java corrections for the old Academy. The mixed source file stays
 * untouched. Academy modules share these object references (some index them at
 * module load), so patch only the known Java entries before the archive renders.
 * This does not assert that the rest of the archived material is reviewed.
 */
const corrections: Readonly<Record<string, Readonly<{ rule: string; summary: string; contrast?: string }>>> = Object.freeze({
  'j-type': {
    rule: '数値の拡大変換と縮小変換を区別する',
    summary: 'intからlong、longからdoubleへの代入は拡大変換だが、longからdoubleでは精度が失われることがある。縮小には原則キャストが必要で、範囲内の定数式など例外もある。',
    contrast: 'Rustの数値型間の変換にはasやFrom/TryFromなどを使う。参照には自動derefなど別の変換もある。',
  },
  'j-immutability': {
    rule: '値の不変性と、参照先まで含む不変性を区別する',
    summary: 'String自体は不変。List.ofのリストは構造を変更できないが、可変な要素は変わりうる。recordの参照先も自動的に不変にはならない。',
  },
  'j-record': {
    rule: 'recordはデータを構成要素で表し、アクセサなどを提供する',
    summary: 'Java 16以降。構成要素のフィールドはprivate finalで、アクセサはname()の形。equals・hashCode・toStringも明示しなければ自動提供されるが、可変な参照先までは不変にならない。',
  },
  'j-compound-assignment': {
    rule: '複合代入は演算と変換を行い、左辺を一度だけ評価する',
    summary: 'byte bに対するb += 1は演算後の縮小変換を伴うが、b = b + 1はそのままでは代入できない。副作用のある左辺を二度評価する単純な展開とは異なる。',
  },
  'j-string': {
    rule: 'Stringは不変。文字列連結は変更ではなく結果の値を作る',
    summary: '中身の比較はequals。ループ中で大きな文字列を繰り返し連結するときはStringBuilderを検討する。変更のない操作が必ず新しいオブジェクトを返すとは限らない。',
  },
});

export function applyLegacyJavaConceptCorrections(): void {
  for (const concept of CONCEPTS) {
    const correction = concept.lang === 'java' ? corrections[concept.id] : undefined;
    if (correction) Object.assign(concept, correction);
  }
}
