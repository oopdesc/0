/**
 * 学習者が書いたメソッド断片を、ブラウザ内エンジンで型検査する。
 *
 * 断片は `class Main { ... }` に包んで検査するので、報告される行番号から
 * 包んだ分（1 行）を引いて元の断片の行に戻す。判定できないものは返さない。
 */
import { checkJava } from '../engine/java/checker';
import type { Diagnostic } from '../components/CodeEditor';

export function javaSnippetCheck(snippet: string): Diagnostic[] | null {
  const lines = snippet.split('\n').length;
  const wrapped = `class Main {\n${snippet}\n  public static void main(String[] args) { }\n}`;
  const res = checkJava(wrapped, 'unit');
  return res.issues
    .filter((i) => i.line >= 2 && i.line <= lines + 1)
    .map((i) => ({
      line: i.line - 1,
      col: i.col,
      message: i.message,
      ...(i.code ? { code: i.code } : {}),
    }));
}
