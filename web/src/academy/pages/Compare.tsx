/**
 * Java と Rust の対応表。
 *
 * 並べているのは既存の問題（実測記録つき）。このページ自体は新しい主張をせず、
 * 「同じ考え方が、言語によってどう変わるか」を 2 列で見せることだけをする。
 */
import { PAIRS } from '../content/pairs';
import { PROBLEM_BY_ID } from '../content';
import { CodeBlock } from '../components/CodeBlock';
import { Link } from '../lib/router';
import type { Problem } from '../content/types';

function outputOf(p: Problem): string[] {
  const e = p.expect;
  if (!e) return ['（実測なし）'];
  if (e.kind === 'output') return e.output.length ? e.output : ['（出力なし）'];
  if (e.kind === 'compile-error') return [`コンパイルエラー: ${e.errorCode}`];
  if (e.kind === 'runtime-error') return [`実行時例外: ${e.exception}`, ...(e.outputBefore ?? [])];
  return ['（コンパイルのみ確認）'];
}

export function ComparePage() {
  return (
    <div className="page page--read">
      <h1>Java と Rust の対応表</h1>
      <p className="lead">
        同じ考え方を 2 言語で並べます。コードと出力は、どちらも実際のツール（JDK 21 / rustc 1.99）で
        実行して記録したものです。ここに書いた違いだけを覚えるのではなく、問題として解いてから見てください。
      </p>

      <ol className="pairs">
        {PAIRS.map((pair) => {
          const j = PROBLEM_BY_ID.get(pair.java);
          const r = PROBLEM_BY_ID.get(pair.rust);
          if (!j || !r) return null;
          return (
            <li key={pair.id} className="pair" id={pair.id}>
              <h2 className="pair__title">{pair.title}</h2>
              <p className="pair__idea">{pair.idea}</p>
              <div className="pair__cols">
                <div className="pair__col">
                  <h3 className="pair__lang">
                    Java <span className="badge">JDK 21</span>
                  </h3>
                  <CodeBlock code={j.code ?? ''} lang="java" label={j.title} dense />
                  <div className="pair__out">
                    {(j.verified?.stdout.length ? j.verified.stdout : outputOf(j)).map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                  <Link to={`/p/${j.id}`} className="link">
                    この問題を解く →
                  </Link>
                </div>
                <div className="pair__col">
                  <h3 className="pair__lang">
                    Rust <span className="badge">rustc 1.99</span>
                  </h3>
                  <CodeBlock code={r.code ?? ''} lang="rust" label={r.title} dense />
                  <div className="pair__out">
                    {(r.verified?.stdout.length ? r.verified.stdout : outputOf(r)).map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                  <Link to={`/p/${r.id}`} className="link">
                    この問題を解く →
                  </Link>
                </div>
              </div>
              <div className="pair__diff">
                <h3 className="pair__sub">何が違うか</h3>
                <p>{pair.difference}</p>
                <p className="pair__trap">
                  <strong>1 行:</strong> {pair.trap}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
