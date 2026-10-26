/**
 * Educational borrow checker — a DOCUMENTED SUBSET of rustc's rules.
 *
 * It is intentionally a linter, not a compiler: it recognises three classic
 * patterns and reports rustc-style error codes. Lessons that use it say so.
 * It never claims to validate real Rust, and it can be switched off per lesson.
 */
import type { LangError } from './ast';

export interface BorrowFinding {
  code: 'E0382' | 'E0499' | 'E0502' | 'E0596';
  line: number;
  col: number;
  message: string;
  rule: string;
}

const DECL_OWNED = /^\s*let\s+(?:mut\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*[A-Za-z_:<>&]+)?\s*=\s*(.+);\s*$/;
const OWNED_RHS = /(String::from|String::new|vec!|format!|to_string|to_owned|planet\(|star\(|Vec::|\bString\b)/;
const MOVE_RHS = /^\s*(?:Some\(|Ok\(|Err\()?([A-Za-z_][A-Za-z0-9_]*)\)?\s*$/;
const MUT_BORROW = /let\s+(?:mut\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*&\s*mut\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/;
const IMM_BORROW = /let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*&\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/;

function usesIdentifier(line: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(line);
}

export function borrowCheck(source: string): BorrowFinding[] {
  const lines = source.split('\n');
  const findings: BorrowFinding[] = [];
  const owned = new Set<string>();
  const moved = new Map<string, number>();
  const mutBorrows = new Map<string, { holder: string; line: number }>();
  const immBorrows = new Map<string, { holder: string; line: number }>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.replace(/\/\/.*$/, '');

    // Rule 1 — move after use (E0382).
    const decl = DECL_OWNED.exec(line);
    if (decl) {
      const name = decl[1]!;
      const rhs = decl[2]!.trim();
      const moveFrom = MOVE_RHS.exec(rhs);
      if (moveFrom && owned.has(moveFrom[1]!)) {
        moved.set(moveFrom[1]!, i + 1);
      } else if (OWNED_RHS.test(rhs)) {
        owned.add(name);
      } else if (moveFrom && !owned.has(moveFrom[1]!)) {
        // Copy-ish value: nothing to track.
      }
    }
    // The move line itself legitimately names the moved variable on its RHS;
    // only later lines count as a use-after-move.
    for (const [name, moveLine] of [...moved]) {
      if (i + 1 <= moveLine) continue;
      if (usesIdentifier(line, name)) {
        findings.push({
          code: 'E0382', line: i + 1, col: Math.max(1, line.indexOf(name) + 1),
          message: `\`${name}\` は ${moveLine} 行目でムーブされたため、ここでは使えません（borrow of moved value）。`,
          rule: '所有権は move で移る。move 後の元変数は原則使えない。',
        });
        moved.delete(name);
      }
    }

    // Rule 2 — two live mutable borrows (E0499).
    const mb = MUT_BORROW.exec(line);
    if (mb) {
      const target = mb[2]!;
      const previous = mutBorrows.get(target);
      const lastUseOfHolder = previous ? lines.findIndex((l, idx) => idx >= previous.line && usesIdentifier(l, previous.holder)) : -1;
      if (previous && lastUseOfHolder >= 0 && lastUseOfHolder < lines.length) {
        findings.push({
          code: 'E0499', line: i + 1, col: Math.max(1, line.indexOf('&mut') + 1),
          message: `\`${target}\` は同時に2つ以上の可変参照を持てません（${previous.holder} がまだ生きています）。`,
          rule: '可変参照 (&mut) は同じスコープに同時に1つだけ。',
        });
      }
      mutBorrows.set(target, { holder: mb[1]!, line: i });
    }

    // Rule 3 — mutable borrow while an immutable borrow is still used (E0502).
    const ib = IMM_BORROW.exec(line);
    if (ib) immBorrows.set(ib[2]!, { holder: ib[1]!, line: i });
    if (mb) {
      const prior = immBorrows.get(mb[2]!);
      if (prior && prior.line < i && lines.slice(prior.line + 1, i + 1).some((l) => usesIdentifier(l, prior.holder))) {
        findings.push({
          code: 'E0502', line: i + 1, col: Math.max(1, line.indexOf('&mut') + 1),
          message: `\`${mb[2]}\` は不変参照 \`${prior.holder}\` が使われている間に可変借用できません。`,
          rule: '不変参照が生きている間は可変参照を作れない。',
        });
      }
    }

    // Rule 4 — mutating a `let` (immutable) binding (E0596).
    const assign = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\+=|-=|\*=|\/=|=(?!=))\s*/.exec(line);
    if (assign && !/let\s|fn\s|for\s|if\s|while\s|==|=>/.test(line)) {
      const name = assign[1]!;
      const declLine = lines.slice(0, i).findIndex((l) => new RegExp(`let\\s+(mut\\s+)?${name}\\b`).test(l));
      if (declLine >= 0 && !/let\s+mut\s/.test(lines[declLine] ?? '')) {
        findings.push({
          code: 'E0596', line: i + 1, col: Math.max(1, line.indexOf(name) + 1),
          message: `\`${name}\` は不変束縛です。変更したい宣言に \`mut\` を付けてください。`,
          rule: 'Rust の let は既定で不変。変更には let mut が必要。',
        });
      }
    }
  }
  return findings;
}

export function findingsToErrors(findings: BorrowFinding[]): LangError[] {
  return findings.map((f) => ({ message: `${f.code}: ${f.message}`, line: f.line, col: f.col, phase: 'borrow' as const }));
}
