import { useMemo, useRef } from 'react';
import type * as React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  dialect: 'java' | 'rust';
  label?: string;
  readOnly?: boolean;
  onRun?: () => void;
  minLines?: number;
  id?: string;
}

type TokenKind = 'comment' | 'string' | 'number' | 'keyword' | 'api' | 'punct' | 'plain';
interface Tok { k: TokenKind; v: string }

const KEYWORDS = new Set([
  'class', 'public', 'private', 'protected', 'static', 'final', 'void', 'int', 'double', 'float',
  'long', 'boolean', 'String', 'new', 'return', 'if', 'else', 'for', 'while', 'this', 'super',
  'extends', 'implements', 'interface', 'abstract', 'record', 'sealed', 'permits', 'package', 'import',
  'let', 'mut', 'fn', 'match', 'in', 'loop', 'break', 'continue', 'true', 'false', 'null', 'None',
  'Some', 'Ok', 'Err', 'pub', 'impl', 'struct', 'enum', 'use', 'self', 'as', 'where',
]);

const API = new Set([
  'clear', 'star', 'planet', 'particle', 'orbit', 'spiral', 'dust', 'gravity', 'timeScale',
  'trails', 'background', 'bodyCount', 'add_star', 'add_planet', 'make_orbit', 'make_spiral',
  'make_dust', 'set_gravity', 'set_time_scale', 'set_trails', 'add_particle', 'body_count',
  'print', 'println', 'vec', 'assert_eq', 'format', 'Math', 'System', 'out', 'len', 'noise',
  'unwrap', 'unwrap_or', 'is_none', 'is_some', 'is_ok', 'is_err', 'String', 'Vec', 'f64',
]);

function tokenize(code: string): Tok[] {
  const out: Tok[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_$][A-Za-z0-9_$]*|\s+|[^\s])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const v = m[0];
    let k: TokenKind = 'plain';
    if (v.startsWith('//') || v.startsWith('/*')) k = 'comment';
    else if (v.startsWith('"') || v.startsWith("'")) k = 'string';
    else if (/^\d/.test(v)) k = 'number';
    else if (/^[A-Za-z_$]/.test(v)) k = KEYWORDS.has(v) ? 'keyword' : API.has(v) ? 'api' : 'plain';
    else if (/^\s+$/.test(v)) k = 'plain';
    else k = 'punct';
    out.push({ k, v });
  }
  return out;
}

const TOKEN_RE = tokenize;

export function CodeEditor({
  value, onChange, dialect, label = 'コードエディタ', readOnly = false, onRun, minLines = 12, id,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => TOKEN_RE(value), [value]);
  const lineCount = Math.max(minLines, value.split('\n').length);
  const lines = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);

  function syncScroll() {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="code-editor" data-dialect={dialect}>
      <div className="code-editor__gutter" ref={gutterRef} aria-hidden="true">
        {lines.map((n) => <span key={n}>{n}</span>)}
      </div>
      <div className="code-editor__body">
        <pre className="code-editor__highlight" ref={preRef} aria-hidden="true">
          {tokens.map((t, i) => <span key={i} className={`tok tok--${t.k}`}>{t.v}</span>)}
          {'\n'}
        </pre>
        <textarea
          id={id}
          ref={taRef}
          className="code-editor__input"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 20000))}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label={label}
          aria-describedby={`${id ?? 'editor'}-hint`}
        />
      </div>
      <p id={`${id ?? 'editor'}-hint`} className="code-editor__hint">
        {dialect === 'java' ? 'Java サブセット' : 'Rust サブセット'} · Ctrl/⌘ + Enter で実行 · Tab でインデント
      </p>
    </div>
  );
}
