/**
 * 実行の 1 行ずつ表示。
 * Java はブラウザ内の実行エンジンが返した実際のステップを使う（作り話ではない）。
 */
import { useState } from 'react';
import type { RunResult } from '../engine/java/interpreter';
import { CodeBlock } from './CodeBlock';

export function TracePlayer({ code, result }: { code: string; result: RunResult }) {
  const steps = result.steps;
  const [i, setI] = useState(Math.min(1, steps.length));
  if (!steps.length) return null;
  const cur = steps[Math.max(0, Math.min(i - 1, steps.length - 1))];

  return (
    <div className="trace">
      <div className="trace__bar">
        <label className="trace__range">
          <span className="sr-only">実行ステップ</span>
          <input
            type="range"
            min={1}
            max={steps.length}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="実行ステップを選ぶ"
          />
        </label>
        <span className="trace__count">
          {i} / {steps.length}
        </span>
        <span className="trace__buttons">
          <button type="button" className="btn btn--tiny" onClick={() => setI(1)} aria-label="最初へ">
            ⏮
          </button>
          <button type="button" className="btn btn--tiny" onClick={() => setI((x) => Math.max(1, x - 1))} aria-label="1 つ前へ">
            ◀
          </button>
          <button type="button" className="btn btn--tiny" onClick={() => setI((x) => Math.min(steps.length, x + 1))} aria-label="1 つ次へ">
            ▶
          </button>
        </span>
      </div>

      <CodeBlock code={code} lang="java" highlight={[cur.line]} dense />

      <div className="trace__panel">
        <div className="trace__row">
          <span className="trace__key">行</span>
          <span className="trace__val">{cur.line}</span>
          <span className="trace__key">できごと</span>
          <span className="trace__val">{cur.label}</span>
        </div>
        <div className="trace__row">
          <span className="trace__key">呼び出し</span>
          <span className="trace__val mono">{cur.stack.join(' ← ') || '—'}</span>
        </div>
        <div className="trace__row">
          <span className="trace__key">変数</span>
          <span className="trace__val mono">
            {cur.vars.length ? cur.vars.map(([name, val]) => `${name} = ${val}`).join('   ') : '—'}
          </span>
        </div>
        <div className="trace__row">
          <span className="trace__key">出力</span>
          <span className="trace__val mono">
            {cur.outputLen > 0 ? result.output.slice(0, cur.outputLen).join(' | ') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
