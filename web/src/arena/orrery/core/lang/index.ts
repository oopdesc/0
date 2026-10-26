import type { Dialect, LangError, RunResult } from './ast';
import type { WorldState } from '../world';
import { runProgram } from './interpreter';
import { borrowCheck, findingsToErrors, type BorrowFinding } from './borrowCheck';

export { runProgram } from './interpreter';
export { borrowCheck, findingsToErrors } from './borrowCheck';
export type { BorrowFinding } from './borrowCheck';
export type { Dialect, LangError, RunResult, TraceStep } from './ast';

export interface ExecuteOptions {
  dialect: Dialect;
  world: WorldState;
  /** Opt-in: run the educational Rust borrow checker before execution. */
  checkBorrows?: boolean;
  hash01?: (i: number, seed: number) => number;
}

export interface ExecuteOutcome {
  result: RunResult;
  findings: BorrowFinding[];
  errors: LangError[];
}

/** Single entry point used by every lesson view. */
export function executeSource(source: string, opts: ExecuteOptions): ExecuteOutcome {
  const findings = opts.checkBorrows && opts.dialect === 'rust' ? borrowCheck(source) : [];
  const borrowErrors = findingsToErrors(findings);
  const result = runProgram(source, {
    dialect: opts.dialect,
    world: opts.world,
    ...(opts.hash01 ? { hash01: opts.hash01 } : {}),
    ...(borrowErrors.length ? { borrowErrors } : {}),
  });
  return { result, findings, errors: [...borrowErrors, ...result.errors] };
}
