/** Java サブセットの字句解析。教材で使う範囲を、JDK と同じ解釈で切る。 */

export type TokKind = 'ident' | 'num' | 'str' | 'char' | 'op' | 'eof';

export interface Token {
  kind: TokKind;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'record',
  'var', 'yield', 'sealed', 'permits', 'non',
]);

export class LexError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(message);
  }
}

const OPS = [
  '>>>=', '<<=', '>>=', '...', '->', '::', '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=',
  '/=', '%=', '&=', '|=', '^=', '<<', '>>', '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^',
  '?', ':', ';', ',', '.', '(', ')', '{', '}', '[', ']', '@',
];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  const adv = (k = 1) => {
    for (let j = 0; j < k; j++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };

  while (i < n) {
    const c = src[i];

    // 空白
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f') {
      adv();
      continue;
    }

    // コメント
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') adv();
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line;
      const sc = col;
      adv(2);
      let closed = false;
      while (i < n) {
        if (src[i] === '*' && src[i + 1] === '/') {
          adv(2);
          closed = true;
          break;
        }
        adv();
      }
      if (!closed) throw new LexError('コメントが閉じていません', sl, sc);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') adv();
      continue;
    }

    // 文字列
    if (c === '"') {
      const sl = line;
      const sc = col;
      if (src[i + 1] === '"' && src[i + 2] === '"') {
        adv(3);
        let buf = '';
        while (i < n && !(src[i] === '"' && src[i + 1] === '"' && src[i + 2] === '"')) {
          buf += src[i];
          adv();
        }
        if (i >= n) throw new LexError('テキストブロックが閉じていません', sl, sc);
        adv(3);
        out.push({ kind: 'str', value: unescapeJava(buf, sl, sc), line: sl, col: sc });
        continue;
      }
      adv();
      let buf = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\n') throw new LexError('文字列リテラルが閉じる前に改行されました', sl, sc);
        if (src[i] === '\\') {
          buf += src[i];
          adv();
          if (i < n) {
            buf += src[i];
            adv();
          }
          continue;
        }
        buf += src[i];
        adv();
      }
      if (i >= n) throw new LexError('文字列リテラルが閉じていません', sl, sc);
      adv();
      out.push({ kind: 'str', value: unescapeJava(buf, sl, sc), line: sl, col: sc });
      continue;
    }

    // 文字
    if (c === "'") {
      const sl = line;
      const sc = col;
      adv();
      let buf = '';
      while (i < n && src[i] !== "'") {
        if (src[i] === '\n') throw new LexError('文字リテラルが閉じる前に改行されました', sl, sc);
        if (src[i] === '\\') {
          buf += src[i];
          adv();
          if (i < n) {
            buf += src[i];
            adv();
          }
          continue;
        }
        buf += src[i];
        adv();
      }
      if (i >= n) throw new LexError('文字リテラルが閉じていません', sl, sc);
      adv();
      const v = unescapeJava(buf, sl, sc);
      if ([...v].length !== 1) throw new LexError('文字リテラルには 1 文字だけを書けます', sl, sc);
      out.push({ kind: 'char', value: v, line: sl, col: sc });
      continue;
    }

    // 数値
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const sl = line;
      const sc = col;
      let buf = '';
      let isHex = false;
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        isHex = true;
        buf += src[i];
        adv();
        buf += src[i];
        adv();
        while (i < n && /[0-9a-fA-F_]/.test(src[i])) {
          if (src[i] !== '_') buf += src[i];
          adv();
        }
      } else if (c === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
        buf += src[i];
        adv();
        buf += src[i];
        adv();
        while (i < n && /[01_]/.test(src[i])) {
          if (src[i] !== '_') buf += src[i];
          adv();
        }
      } else {
        while (i < n && /[0-9_]/.test(src[i])) {
          if (src[i] !== '_') buf += src[i];
          adv();
        }
        if (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? '')) {
          buf += '.';
          adv();
          while (i < n && /[0-9_]/.test(src[i])) {
            if (src[i] !== '_') buf += src[i];
            adv();
          }
        } else if (src[i] === '.' && !/[a-zA-Z(]/.test(src[i + 1] ?? '')) {
          buf += '.';
          adv();
        }
        if (src[i] === 'e' || src[i] === 'E') {
          buf += 'e';
          adv();
          if (src[i] === '+' || src[i] === '-') {
            buf += src[i];
            adv();
          }
          while (i < n && /[0-9]/.test(src[i])) {
            buf += src[i];
            adv();
          }
        }
      }
      // 接尾辞
      let suffix = '';
      if (/[lLfFdD]/.test(src[i] ?? '')) {
        suffix = src[i];
        adv();
      }
      if (isHex && suffix && /[lL]/.test(suffix)) {
        out.push({ kind: 'num', value: buf + suffix, line: sl, col: sc });
      } else {
        out.push({ kind: 'num', value: buf + suffix, line: sl, col: sc });
      }
      continue;
    }

    // 識別子 / キーワード
    if (/[A-Za-z_$\u00c0-\uffff]/.test(c)) {
      const sl = line;
      const sc = col;
      let buf = '';
      while (i < n && /[A-Za-z0-9_$\u00c0-\uffff]/.test(src[i])) {
        buf += src[i];
        adv();
      }
      out.push({ kind: KEYWORDS.has(buf) ? 'op' : 'ident', value: buf, line: sl, col: sc });
      continue;
    }

    // 演算子
    let matched = '';
    for (const op of OPS) {
      if (src.startsWith(op, i)) {
        matched = op;
        break;
      }
    }
    if (matched) {
      out.push({ kind: 'op', value: matched, line, col });
      adv(matched.length);
      continue;
    }

    throw new LexError(`解釈できない文字です: ${JSON.stringify(c)}`, line, col);
  }

  out.push({ kind: 'eof', value: '', line, col });
  return out;
}

function unescapeJava(raw: string, line: number, col: number): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const d = raw[++i];
    switch (d) {
      case 'n': out += '\n'; break;
      case 't': out += '\t'; break;
      case 'r': out += '\r'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case 's': out += ' '; break;
      case '0': out += '\0'; break;
      case '"': out += '"'; break;
      case "'": out += "'"; break;
      case '\\': out += '\\'; break;
      case 'u': {
        const hex = raw.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new LexError('\\u のあとは 16 進 4 桁です', line, col);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        break;
      }
      default:
        throw new LexError(`未知のエスケープです: \\${d}`, line, col);
    }
  }
  return out;
}

export const JAVA_KEYWORDS = KEYWORDS;
