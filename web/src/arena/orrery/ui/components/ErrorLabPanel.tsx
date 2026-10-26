import { useMemo } from 'react';

interface Props {
  prediction: string;
  actual: string;
  explanation: string;
  patch: string;
  solution?: string;
  errors?: string[];
  onSavePatch?: () => void;
  onRebuild?: () => void;
  onExplain?: () => void;
  patchSaved?: boolean;
}

/** First differing token — the discrepancy itself is the teaching material. */
function firstDifference(a: string, b: string): { left: string; right: string } {
  const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const x = norm(a).split(/([\s,;]+)/);
  const y = norm(b).split(/([\s,;]+)/);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    if (x[i] !== y[i]) return { left: x[i] ?? '（なし）', right: y[i] ?? '（なし）' };
  }
  return { left: '（同じ）', right: '（同じ）' };
}

export function ErrorLabPanel({
  prediction, actual, explanation, patch, solution, errors = [],
  onSavePatch, onRebuild, onExplain, patchSaved,
}: Props) {
  const diff = useMemo(() => firstDifference(prediction, actual), [prediction, actual]);

  return (
    <section className="errorlab" aria-labelledby="errorlab-title">
      <div className="errorlab__head">
        <span className="errorlab__tag">誤りの記録</span>
        <h3 id="errorlab-title">予測と現実の誤差を、教材にする</h3>
      </div>

      <div className="errorlab__compare">
        <div className="errorlab__cell">
          <span className="errorlab__label">自分の予測</span>
          <p className="errorlab__value">{prediction || '（予測なし）'}</p>
        </div>
        <div className="errorlab__cell errorlab__cell--actual">
          <span className="errorlab__label">実際の結果</span>
          <p className="errorlab__value">{actual || '（出力なし）'}</p>
        </div>
      </div>

      <div className="errorlab__diff">
        <span className="errorlab__label">差分</span>
        <p><code>{diff.left}</code> <span aria-hidden="true">→</span> <code>{diff.right}</code></p>
      </div>

      {errors.length > 0 && (
        <div className="errorlab__errors">
          <span className="errorlab__label">実行時の通知</span>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <div className="errorlab__reason">
        <span className="errorlab__label">なぜ違ったか</span>
        <p>{explanation}</p>
      </div>

      <div className="errorlab__rule">
        <span className="errorlab__label">正しい規則 / 1行パッチ</span>
        <code>{patch}</code>
        <button type="button" onClick={onSavePatch} disabled={patchSaved}>
          {patchSaved ? '保存済み' : 'この規則を復習に保存'}
        </button>
      </div>

      {solution && (
        <details className="errorlab__solution">
          <summary>修正版を見る（まず自分で直してから）</summary>
          <pre><code>{solution}</code></pre>
        </details>
      )}

      <div className="errorlab__actions">
        {onExplain && <button type="button" onClick={onExplain}>もう一度説明する</button>}
        {onRebuild && <button type="button" className="primary" onClick={onRebuild}>自分で作り直す</button>}
      </div>
    </section>
  );
}
