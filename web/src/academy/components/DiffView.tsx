/**
 * STEP 5: 予測と実際の差分。
 * 「どちらが正しいか」ではなく「どこで考えがずれたか」を見せる。
 */
import type { Problem } from '../content/types';
import type { AnswerValue } from './AnswerInput';
import { diffLines } from '../lib/diff';
import { gradeCodeAnswer } from '../lib/gradeCode';
import { compareOutput } from '../../learning-v2/comparison';
import { CodeBlock } from './CodeBlock';

export function predictionText(p: Problem, v: AnswerValue | null): string[] {
  const a = p.answer;
  if (!v) return ['（予測なし）'];
  if (a.mode === 'choice' && v.kind === 'choice') return [a.options[v.index]?.text ?? '（未選択）'];
  if (a.mode === 'text' && v.kind === 'text') return v.text.split('\n');
  if (a.mode === 'blanks' && v.kind === 'blanks') return v.values.map((x, i) => `${a.blanks[i]?.label ?? `空欄${i + 1}`}: ${x}`);
  if (a.mode === 'order' && v.kind === 'order') return v.order.map((idx, i) => `${i + 1}. ${a.lines[idx]}`);
  if (a.mode === 'code' && v.kind === 'code') return v.text.split('\n');
  return ['（未入力）'];
}

export function actualText(p: Problem): string[] {
  const e = p.expect;
  if (!e) return p.answer.mode==='choice' ? [p.answer.options[p.answer.correct].text] : ['（この問題は実行しません）'];
  if (e.kind === 'output') return e.output.length ? e.output : ['（出力なし）'];
  if (e.kind === 'compile-error') return [`コンパイルエラー: ${e.errorCode}`];
  if (e.kind === 'runtime-error') return [`実行時例外: ${e.exception}`, ...(e.outputBefore ?? [])];
  return ['（コンパイルのみ確認）'];
}

export function actualSource(p: Problem): { tool: string; version: string; lines: string[] } | null {
  const v = p.verified;
  if (!v) return null;
  return { tool: v.tool, version: v.version, lines: v.stderr.slice(0, 3) };
}

export function isCorrect(p: Problem, v: AnswerValue | null): boolean {
  const a = p.answer;
  if (!v) return false;
  if (a.mode === 'choice' && v.kind === 'choice') return v.index === a.correct;
  if (a.mode === 'text' && v.kind === 'text' && p.expect?.kind === 'output') {
    return compareOutput(v.text, p.expect.output, 'exact-lines');
  }
  if (a.mode === 'blanks' && v.kind === 'blanks') {
    return a.blanks.every((b, i) => b.accept.some((acc) => acc.trim() === (v.values[i] ?? '').trim()));
  }
  if (a.mode === 'order' && v.kind === 'order') return v.order.every((x, i) => x === i);
  // コード問題は、書いたコードを実際に走らせて採点する（Rust / tests なしは簡易チェックのみ）
  if (a.mode === 'code' && v.kind === 'code') {
    const grade = gradeCodeAnswer(p, v.text);
    return grade.ran && grade.ok;
  }
  return false;
}

export function DiffView({ p, value, correct }: { p: Problem; value: AnswerValue | null; correct: boolean }) {
  const v = value;
  const mine = predictionText(p, value);
  const actual = actualText(p);
  const rows = diffLines(mine, actual);
  const src = actualSource(p);
  const ungraded = p.answer.mode === 'code' && v?.kind === 'code' && !gradeCodeAnswer(p, v.text).ran;

  return (
    <div className="diff">
      <div className="diff__head">
        <span className={`diff__verdict ${ungraded ? '' : correct ? 'is-ok' : 'is-bad'}`}>
          {ungraded ? '未判定' : correct ? (p.runnable===false?'正解':'一致') : (p.runnable===false?'見直す':'ずれ')}
        </span>
        <span className="diff__caption">
          {ungraded ? '実行できていないため、正誤を確定しません。' : correct ? (p.runnable===false?'正解です。解説を読み、理由も確かめてください。':'予測と実際が一致しました。次は同じ核心を別の形で。') : 'どこでずれたかを確認する。'}
        </span>
      </div>
      <div className="diff__cols">
        <div className="diff__col">
          <h4 className="diff__title">あなたの予測</h4>
          <ol className="diff__lines">
            {rows
              .filter((r) => r.kind !== 'add')
              .map((r, i) => (
                <li key={i} className={`diff__line diff__line--${r.kind}`}>
                  <span className="diff__text">{r.text || '\u00a0'}</span>
                </li>
              ))}
          </ol>
        </div>
        <div className="diff__col">
          <h4 className="diff__title">
            {p.runnable===false?'解説で確かめる':'検証記録の結果'}
            {p.verified && <span className="badge badge--verified">{p.verified.tool === 'javac' || p.verified.tool === 'java' ? 'JDK検証記録' : 'rustc検証記録'}</span>}
          </h4>
          <ol className="diff__lines">
            {rows
              .filter((r) => r.kind !== 'del')
              .map((r, i) => (
                <li key={i} className={`diff__line diff__line--${r.kind === 'add' ? 'add' : r.kind}`}>
                  <span className="diff__text">{r.text || '\u00a0'}</span>
                </li>
              ))}
          </ol>
        </div>
      </div>
      {p.answer.mode === 'choice' && (
        <div className="diff__why">
          <p className="diff__hint">正解は「{p.answer.options[p.answer.correct]?.text}」。</p>
          {(() => {
            const picked = v?.kind === 'choice' ? v.index : undefined;
            const mine = picked !== undefined && picked !== p.answer.correct ? p.optionNotes?.[picked] : undefined;
            const others = Object.entries(p.optionNotes ?? {}).filter(([k]) => Number(k) !== picked);
            return (
              <>
                {mine && (
                  <div className="diff__picked">
                    <span className="diff__picked-label">あなたが選んだ「{p.answer.options[picked!]?.text}」</span>
                    <p>{mine}</p>
                  </div>
                )}
                {others.length > 0 && (
                  <details className="diff__others">
                    <summary>ほかの選択肢はなぜ違うか（{others.length} 件）</summary>
                    <ul>
                      {others.map(([k, note]) => (
                        <li key={k}>
                          <strong>{p.answer.mode === 'choice' ? p.answer.options[Number(k)]?.text : ''}</strong>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
        </div>
      )}
      {src && !correct && (
        <details className="diff__raw">
          <summary>{src.version} の出力（先頭 3 行）</summary>
          <pre className="rawlog">{src.lines.join('\n') || '（標準エラー出力なし）'}</pre>
        </details>
      )}
      {p.verified?.compiledSource && p.verified.tool === 'rustc' && (
        <details className="diff__raw">
          <summary>コンパイルしたコード（そのまま）</summary>
          <CodeBlock code={p.verified.compiledSource} lang="rust" dense />
        </details>
      )}
    </div>
  );
}
