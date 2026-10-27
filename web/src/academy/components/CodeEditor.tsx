/**
 * コード入力。
 *
 * テキストエリアのままだと、インデント・閉じ括弧・タブ移動がすべて手作業になり、
 * 「書く練習」の摩擦が大きすぎる。ここでは次の 4 つだけを実装する（IDE の再発明はしない）。
 *   - 行番号（スクロール位置を同期）
 *   - Enter で直前の行と同じインデント / `{` の後は +2
 *   - Tab / Shift+Tab でインデント、閉じ括弧・引用符の自動補完
 *   - Ctrl / Cmd + Enter で確定（呼び出し側が渡したときだけ）
 *
 * 診断（下に出すエラー一覧）は、呼び出し側が渡した関数の結果をそのまま表示する。
 * Java ではブラウザ内エンジンが実際に型検査した結果。Rust では渡さない（無いものを出さない）。
 */
import { useEffect, useRef, useState } from 'react';

export interface Diagnostic {
  line: number;
  col: number;
  message: string;
  code?: string;
}

const INDENT = '  ';

export function CodeEditor({
  value,
  onChange,
  disabled,
  lang,
  rows = 10,
  onCommit,
  check,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  lang: 'java' | 'rust';
  rows?: number;
  onCommit?: () => void;
  /** 遅延実行する事前チェック。null を返すと「未対応」として何も出さない。 */
  check?: (code: string) => Diagnostic[] | null;
  label?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [diag, setDiag] = useState<Diagnostic[] | null>(null);
  const [checked, setChecked] = useState(false);

  // 入力が止まってから検査する（1 文字ごとに解析しない）
  useEffect(() => {
    if (!check || disabled) return;
    const t = setTimeout(() => {
      try {
        const d = check(value);
        setDiag(d);
        setChecked(d !== null);
      } catch {
        setDiag(null);
        setChecked(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, check, disabled]);

  const lineCount = Math.max(rows, value.split('\n').length);

  function insert(text: string, caretOffset = text.length) {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = value.slice(0, s) + text + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + caretOffset;
    });
  }

  /** 選択範囲の各行をまとめて字下げ / 戻す */
  function reindent(direction: 1 | -1) {
    const el = ta.current;
    if (!el) return;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const endIdx = value.indexOf('\n', el.selectionEnd);
    const end = endIdx === -1 ? value.length : endIdx;
    const block = value.slice(start, end);
    const lines = block.split('\n');
    const changed = lines.map((l) =>
      direction === 1 ? INDENT + l : l.startsWith(INDENT) ? l.slice(INDENT.length) : l,
    );
    const next = value.slice(0, start) + changed.join('\n') + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = start;
      el.selectionEnd = start + changed.join('\n').length;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (onCommit) {
        e.preventDefault();
        onCommit();
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) reindent(-1);
      else if (ta.current && ta.current.selectionStart !== ta.current.selectionEnd) reindent(1);
      else insert(INDENT);
      return;
    }
    if (e.key === 'Enter') {
      const el = ta.current;
      if (!el) return;
      const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
      const line = value.slice(lineStart, el.selectionStart);
      const indent = (line.match(/^[ \t]*/) ?? [''])[0];
      const opensBlock = /\{\s*$/.test(line);
      const nextChar = value[el.selectionStart] ?? '';
      e.preventDefault();
      if (opensBlock && (nextChar === '}' || nextChar === '')) {
        // ブロックを開いた直後は、閉じ括弧まで先に作ってカーソルを内側へ
        if (nextChar === '}') {
          insert(`\n${indent}${INDENT}\n${indent}`, indent.length + INDENT.length + 1);
          return;
        }
        insert(`\n${indent}${INDENT}`, indent.length + INDENT.length + 1);
        return;
      }
      insert(`\n${indent}`, indent.length + 1);
      return;
    }
    if (e.key === '{') {
      e.preventDefault();
      insert('{}', 1);
      return;
    }
    if (e.key === '(') {
      e.preventDefault();
      insert('()', 1);
      return;
    }
    if (e.key === '"') {
      e.preventDefault();
      insert('""', 1);
      return;
    }
    if (e.key === '}' && value[ta.current?.selectionStart ?? 0] === '}') {
      // 自動補完された閉じ括弧の上で打ったときは、カーソルを進めるだけ
      e.preventDefault();
      const el = ta.current!;
      el.selectionStart = el.selectionEnd = el.selectionStart + 1;
      return;
    }
  }

  return (
    <div className={`editor ${disabled ? 'is-disabled' : ''}`} data-lang={lang}>
      <div className="editor__gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i} className={diag?.some((d) => d.line === i + 1) ? 'is-error' : undefined}>
            {i + 1}
          </span>
        ))}
      </div>
      <textarea
        ref={ta}
        className="editor__area"
        rows={lineCount}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={value}
        disabled={disabled}
        aria-label={label ?? `${lang} のコード入力`}
        onKeyDown={onKeyDown}
        onScroll={() => {
          if (gutter.current && ta.current) gutter.current.scrollTop = ta.current.scrollTop;
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="editor__foot" aria-live="polite">
        {check && checked && diag && diag.length === 0 && <span className="editor__ok">型チェック: エラーなし</span>}
        {check && checked && diag && diag.length > 0 && (
          <span className="editor__bad">型チェック: {diag.length} 件（確定して実行すると採点されます）</span>
        )}
        {check && !checked && <span className="editor__hint">型チェックは入力が止まると走ります</span>}
        {!check && lang === 'rust' && (
          <span className="editor__hint">Rust はブラウザでコンパイルしません（構文チェックは行いません）</span>
        )}
        <span className="editor__keys">
          <kbd>Tab</kbd> 字下げ / <kbd>Shift</kbd>+<kbd>Tab</kbd> 戻す
          {onCommit && (
            <>
              {' / '}
              <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 確定
            </>
          )}
        </span>
      </div>
      {check && checked && diag && diag.length > 0 && (
        <ul className="editor__diag">
          {diag.slice(0, 6).map((d, i) => (
            <li key={i}>
              <span className="editor__diag-pos mono">
                {d.line}:{d.col}
              </span>{' '}
              {d.message}
            </li>
          ))}
          {diag.length > 6 && <li>ほか {diag.length - 6} 件</li>}
        </ul>
      )}
    </div>
  );
}
