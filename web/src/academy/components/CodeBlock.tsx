/**
 * コード表示。行番号・強調行・空欄（____）の下線に対応する。
 * ハイライトは外部ライブラリを使わず、この 1 ファイルで完結させる（バンドルを増やさない）。
 */
import { useMemo } from 'react';

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'sealed', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized',
  'this', 'throw', 'throws', 'transient', 'try', 'var', 'void', 'volatile', 'while', 'record', 'yield',
  'true', 'false', 'null', 'permits',
]);

const RUST_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false',
  'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  'String', 'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err', 'Box',
]);

type Tok = { t: 'kw' | 'str' | 'num' | 'com' | 'fn' | 'ty' | 'punc' | 'id' | 'ws'; v: string };

function tokenize(line: string, lang: 'java' | 'rust' | 'javascript' | 'text'): Tok[] {
  const kw = lang === 'java' ? JAVA_KEYWORDS : lang === 'rust' ? RUST_KEYWORDS : new Set<string>();
  const out: Tok[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#\[[^\]]*\]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d[\w.]*\b|[A-Za-z_$][\w$]*|\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const v = m[0];
    if (/^\s+$/.test(v)) out.push({ t: 'ws', v });
    else if (v.startsWith('//') || v.startsWith('/*')) out.push({ t: 'com', v });
    else if (v.startsWith('"') || v.startsWith("'")) out.push({ t: 'str', v });
    else if (v.startsWith('#[')) out.push({ t: 'ty', v });
    else if (/^\d/.test(v)) out.push({ t: 'num', v });
    else if (/^[A-Za-z_$]/.test(v)) {
      if (kw.has(v)) out.push({ t: 'kw', v });
      else if (/^[A-Z]/.test(v)) out.push({ t: 'ty', v });
      else out.push({ t: 'id', v });
    } else out.push({ t: 'punc', v });
  }
  return out;
}

export function CodeBlock({
  code,
  lang,
  highlight = [],
  startLine = 1,
  label,
  dense,
}: {
  code: string;
  lang: 'java' | 'rust' | 'javascript' | 'text';
  highlight?: number[];
  startLine?: number;
  label?: string;
  dense?: boolean;
}) {
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);
  const hl = new Set(highlight);

  return (
    <figure className={`codeblock ${dense ? 'codeblock--dense' : ''}`}>
      {label && <figcaption className="codeblock__label">{label}</figcaption>}
      <pre className="codeblock__pre" tabIndex={0} aria-label={`${lang} のコード`}>
        <code>
          {lines.map((line, i) => {
            const n = startLine + i;
            const blank = line.includes('____');
            return (
              <span key={n} className={`codeblock__line ${hl.has(n) ? 'is-hl' : ''}`} data-line={n}>
                <span className="codeblock__no" aria-hidden="true">
                  {n}
                </span>
                <span className={`codeblock__code ${blank ? 'has-blank' : ''}`}>
                  {line.length === 0 ? '\u00a0' : tokenize(line, lang).map((t, j) => (
                    <span key={j} className={`tok tok--${t.t}`}>
                      {t.v}
                    </span>
                  ))}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}
