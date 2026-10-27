/**
 * 回答の入力。方式（選択・記述・穴埋め・並べ替え・コード）ごとに UI を変えるが、
 * 「予測を入力してから確定する」という流れは全方式で同じ。
 */
import type { Answer } from '../content/types';
import { CodeBlock } from './CodeBlock';
import { CodeEditor, type Diagnostic } from './CodeEditor';

export type AnswerValue = { kind: 'choice'; index: number } | { kind: 'text'; text: string } | { kind: 'blanks'; values: string[] } | { kind: 'order'; order: number[] } | { kind: 'code'; text: string };

export function isAnswered(a: Answer, v: AnswerValue | null): boolean {
  if (!v) return false;
  switch (a.mode) {
    case 'choice':
      return v.kind === 'choice' && v.index >= 0;
    case 'text':
      return v.kind === 'text' && v.text.trim().length > 0;
    case 'blanks':
      return v.kind === 'blanks' && v.values.every((x) => x.trim().length > 0);
    case 'order':
      return v.kind === 'order' && v.order.length > 0;
    case 'code':
      return v.kind === 'code' && v.text.trim().length > 0;
  }
}

export function AnswerInput({
  answer,
  value,
  onChange,
  disabled,
  lang,
  shuffled,
  codeCheck,
  onCommit,
}: {
  answer: Answer;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  lang: 'java' | 'rust';
  /** 選択肢の表示順（復習では毎回変える） */
  shuffled?: number[];
  /** コード問題の事前チェック（Java のみ実装がある） */
  codeCheck?: (code: string) => Diagnostic[] | null;
  /** Ctrl / Cmd + Enter で確定する */
  onCommit?: () => void;
}) {
  if (answer.mode === 'choice') {
    const order = shuffled ?? answer.options.map((_, i) => i);
    return (
      <fieldset className="choices" disabled={disabled}>
        <legend className="sr-only">予測を選ぶ</legend>
        {order.map((idx, display) => {
          const opt = answer.options[idx];
          const checked = value?.kind === 'choice' && value.index === idx;
          return (
            <label key={idx} className={`choice ${checked ? 'is-checked' : ''}`}>
              <input
                type="radio"
                name="answer"
                checked={checked}
                onChange={() => onChange({ kind: 'choice', index: idx })}
                aria-label={`選択肢 ${String.fromCharCode(65 + display)}`}
              />
              <span className="choice__key" aria-hidden="true">
                {String.fromCharCode(65 + display)}
              </span>
              <span className="choice__text">{opt.text}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (answer.mode === 'text') {
    const v = value?.kind === 'text' ? value.text : '';
    return answer.multiline ? (
      <textarea
        className="input input--area"
        rows={4}
        placeholder={answer.placeholder ?? '出力や値をそのまま書く'}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange({ kind: 'text', text: e.target.value })}
      />
    ) : (
      <input
        className="input"
        placeholder={answer.placeholder ?? '出力や値をそのまま書く'}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange({ kind: 'text', text: e.target.value })}
      />
    );
  }

  if (answer.mode === 'blanks') {
    const vals = value?.kind === 'blanks' ? value.values : answer.blanks.map(() => '');
    return (
      <div className="blanks">
        {answer.blanks.map((b, i) => (
          <label key={i} className="blanks__row">
            <span className="blanks__label">{b.label}</span>
            <input
              className="input input--blank"
              value={vals[i] ?? ''}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                const next = vals.slice();
                next[i] = e.target.value;
                onChange({ kind: 'blanks', values: next });
              }}
            />
          </label>
        ))}
      </div>
    );
  }

  if (answer.mode === 'order') {
    const order = value?.kind === 'order' ? value.order : answer.lines.map((_, i) => i);
    const move = (from: number, to: number) => {
      if (to < 0 || to >= order.length) return;
      const next = order.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      onChange({ kind: 'order', order: next });
    };
    return (
      <ol className="order">
        {order.map((lineIdx, pos) => (
          <li key={lineIdx} className="order__item">
            <span className="order__pos">{pos + 1}</span>
            <span className="order__text">{answer.lines[lineIdx]}</span>
            <span className="order__buttons">
              <button
                type="button"
                className="btn btn--tiny"
                disabled={disabled || pos === 0}
                onClick={() => move(pos, pos - 1)}
                aria-label={`${pos + 1} 行目を上へ`}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn--tiny"
                disabled={disabled || pos === order.length - 1}
                onClick={() => move(pos, pos + 1)}
                aria-label={`${pos + 1} 行目を下へ`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  const v = value?.kind === 'code' ? value.text : answer.starter;
  return (
    <div className="codeedit">
      <CodeEditor
        value={v}
        onChange={(text) => onChange({ kind: 'code', text })}
        disabled={disabled}
        lang={lang}
        rows={9}
        check={codeCheck}
        onCommit={disabled ? undefined : onCommit}
        label={`${lang} のコード入力`}
      />
      {answer.reference && disabled && (
        <details className="codeedit__ref">
          <summary>参照解（採点には使いません）</summary>
          <CodeBlock code={answer.reference} lang={lang} dense />
        </details>
      )}
    </div>
  );
}
