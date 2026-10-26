import type { LangError, Pos } from './ast';

export type TokenType = 'num' | 'str' | 'ident' | 'op' | 'eof';

export interface Token {
  t: TokenType;
  v: string;
  num?: number;
  isInt?: boolean;
  pos: Pos;
}

const TWO_CHAR = ['=>', '->', '::', '..', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '++', '--'];
const SINGLE = new Set('+-*/%=<>(){}[];,.:!?&|#'.split(''));

/** Tokenise the Java/Rust teaching subset. Throws nothing; returns an error. */
export function lex(source: string): { tokens: Token[]; error: LangError | null } {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = source.length;

  const pos = (): Pos => ({ line, col });
  const advance = (count = 1): void => {
    for (let c = 0; c < count; c++) {
      if (i >= n) break;
      if (source[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < n) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') advance();
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      advance(2);
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) advance();
      advance(2);
      continue;
    }
    // Rust attributes (#![...] / #[...]) and Java annotations are ignored.
    if (ch === '#') {
      while (i < n && source[i] !== '\n') advance();
      continue;
    }
    if (ch === '@') {
      while (i < n && source[i] !== '\n') advance();
      continue;
    }

    const start = pos();

    if (ch >= '0' && ch <= '9') {
      let text = '';
      while (i < n && /[0-9_]/.test(source[i])) {
        text += source[i];
        advance();
      }
      let isInt = true;
      if (source[i] === '.' && source[i + 1] !== '.') {
        isInt = false;
        text += '.';
        advance();
        while (i < n && /[0-9_]/.test(source[i])) {
          text += source[i];
          advance();
        }
      }
      // Rust numeric suffixes (1u32, 2.0f64, 3usize) are type hints, not values.
      let suffix = '';
      while (i < n && /[a-zA-Z_]/.test(source[i])) {
        suffix += source[i];
        advance();
      }
      const clean = text.replace(/_/g, '');
      const num = Number(clean);
      if (!Number.isFinite(num)) {
        return { tokens, error: { message: `数値が大きすぎます: ${text}`, ...start, phase: 'lex' } };
      }
      tokens.push({ t: 'num', v: clean, num, isInt, pos: start });
      void suffix;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance();
      let value = '';
      let closed = false;
      while (i < n) {
        if (source[i] === quote) {
          advance();
          closed = true;
          break;
        }
        if (source[i] === '\\') {
          advance();
          const esc = source[i];
          if (esc === 'n') value += '\n';
          else if (esc === 't') value += '\t';
          else if (esc === 'r') value += '\r';
          else if (esc === '\\') value += '\\';
          else if (esc === '"') value += '"';
          else if (esc === "'") value += "'";
          else value += esc ?? '';
          advance();
          continue;
        }
        if (source[i] === '\n') {
          return { tokens, error: { message: '文字列が改行で閉じられていません', ...start, phase: 'lex' } };
        }
        value += source[i];
        advance();
      }
      if (!closed) {
        return { tokens, error: { message: '文字列が閉じられていません', ...start, phase: 'lex' } };
      }
      tokens.push({ t: 'str', v: value, pos: start });
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let name = '';
      while (i < n && /[A-Za-z0-9_$]/.test(source[i])) {
        name += source[i];
        advance();
      }
      tokens.push({ t: 'ident', v: name, pos: start });
      continue;
    }

    const two = source.slice(i, i + 2);
    if (TWO_CHAR.includes(two)) {
      tokens.push({ t: 'op', v: two, pos: start });
      advance(2);
      continue;
    }
    if (SINGLE.has(ch)) {
      tokens.push({ t: 'op', v: ch, pos: start });
      advance();
      continue;
    }
    return {
      tokens,
      error: { message: `解釈できない文字です: "${ch}"`, ...start, phase: 'lex' },
    };
  }

  tokens.push({ t: 'eof', v: '<eof>', pos: pos() });
  return { tokens, error: null };
}

/** Keywords that may appear before a name in a declaration / signature. */
export const MODIFIERS = new Set([
  'public', 'private', 'protected', 'static', 'final', 'abstract', 'sealed', 'non', 'default',
  'synchronized', 'native', 'strictfp', 'const', 'let', 'mut', 'pub', 'override', 'open',
]);

export const INT_TYPES = new Set(['int', 'long', 'short', 'byte', 'char', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize']);
export const FLOAT_TYPES = new Set(['double', 'float', 'f32', 'f64']);

export function typeCategory(typeName: string): 'int' | 'float' | 'other' {
  const base = typeName.replace(/\[\]|<.*>|&|\s|\?/g, '').trim();
  if (INT_TYPES.has(base)) return 'int';
  if (FLOAT_TYPES.has(base)) return 'float';
  return 'other';
}
