/**
 * build-mini（コードを書く問題）の採点。
 *
 * 二種類しかない。どちらも「実行したふり」をしないための区別。
 *  - 実行して採点できる（Java + tests）: 利用者のコードをブラウザ内エンジンで実際に走らせ、
 *    テストごとの出力を期待値と比べる。落ちた理由も返す。
 *  - 実行できない（Rust / tests なし）: lint（使うべき要素・行数）だけを見て、
 *    「実行はしていない簡易チェック」と明示する。mastery の確定には使わない。
 */
import type { Problem } from '../content/types';
import { runJava } from '../engine/java/interpreter';

export interface CodeTestResult {
  input: string;
  expected: string[];
  got: string[];
  ok: boolean;
  error?: string;
}

export interface CodeGrade {
  /** 実際に実行して採点したか（false のときは簡易チェック） */
  ran: boolean;
  ok: boolean;
  tests: CodeTestResult[];
  notes: string[];
  /** 実行できなかった理由（未対応構文など） */
  error?: string;
}

/** 参照解からメソッド名を取り出す（採点用の呼び出しを作るため） */
function methodNameOf(reference: string): string | null {
  const m = reference.match(/(?:static\s+)?[\w<>\[\],.\s]+?\s(\w+)\s*\(/);
  return m?.[1] ?? null;
}

function lintCheck(p: Problem, code: string): string[] {
  const a = p.answer;
  if (a.mode !== 'code' || !a.lint) return [];
  const notes: string[] = [];
  const lines = code.split('\n').filter((l) => l.trim().length > 0).length;
  if (a.lint.minLines && lines < a.lint.minLines) notes.push(`行数が足りません（${a.lint.minLines} 行以上）`);
  for (const s of a.lint.must ?? []) if (!code.includes(s)) notes.push(`「${s}」を使っていません`);
  for (const s of a.lint.mustNot ?? []) if (code.includes(s)) notes.push(`「${s}」は使わないでください`);
  for (const s of a.lint.mustMatch ?? []) if (!new RegExp(s).test(code)) notes.push(`「${s}」の形になっていません`);
  return notes;
}

export function gradeCodeAnswer(p: Problem, userCode: string): CodeGrade {
  const a = p.answer;
  if (a.mode !== 'code') return { ran: false, ok: false, tests: [], notes: ['コード問題ではありません'] };

  const lintNotes = lintCheck(p, userCode);

  // 実行して採点できるのは、Java で tests があるときだけ
  if (p.lang !== 'java' || !a.tests?.length) {
    return {
      ran: false,
      ok: lintNotes.length === 0 && userCode.trim().length > 0,
      tests: [],
      notes: lintNotes.length ? lintNotes : ['実行はしていない簡易チェックです（構文の存在と行数のみ）'],
    };
  }

  const name = methodNameOf(a.reference);
  if (!name) {
    return { ran: false, ok: false, tests: [], notes: ['採点用のメソッド名を特定できませんでした'], error: 'no-method-name' };
  }

  const tests: CodeTestResult[] = [];
  for (const t of a.tests) {
    const call = t.input ? `${name}(${t.input})` : `${name}()`;
    const source = `class Main {\n${userCode}\n  public static void main(String[] args) {\n    System.out.println(${call});\n  }\n}`;
    const res = runJava(source, { mode: 'unit' });
    const got = res.output;
    const error = res.compileError
      ? `コンパイルエラー: ${res.compileError.message}`
      : res.error
        ? `${res.error.type}: ${res.error.message}`
        : undefined;
    tests.push({
      input: t.input ?? '',
      expected: t.expectOutput,
      got,
      ok: !error && got.length === t.expectOutput.length && got.every((line, i) => line === t.expectOutput[i]),
      ...(error ? { error } : {}),
    });
  }

  const ok = tests.every((t) => t.ok) && lintNotes.length === 0;
  return {
    ran: true,
    ok,
    tests,
    notes: lintNotes,
    ...(tests.some((t) => t.error) ? { error: tests.find((t) => t.error)!.error } : {}),
  };
}
