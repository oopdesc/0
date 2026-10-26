/**
 * Predict -> Execute -> Error -> Explain -> Patch -> Rebuild -> Retrieve -> Transfer.
 *
 * This is a pure reducer. The UI can therefore be tested without a DOM and the
 * "error" branch is only entered when the learner's prediction actually differs
 * from reality — the discrepancy itself becomes the teaching material.
 */
export type LoopPhase =
  | 'predict' | 'execute' | 'error' | 'explain' | 'patch' | 'rebuild' | 'retrieve' | 'transfer' | 'done';

export interface RunSummary {
  ok: boolean;
  output: string[];
  errors: string[];
  bodyCount: number;
  elapsedMs: number;
}

export interface LoopState {
  phase: LoopPhase;
  prediction: string;
  attempts: number;
  lastRun: RunSummary | null;
  discrepancy: boolean;
  patchSaved: boolean;
  revealed: boolean;
  history: LoopPhase[];
}

export type LoopAction =
  | { type: 'PREDICT'; value: string }
  | { type: 'EXECUTE'; run: RunSummary; actual: string }
  | { type: 'EXPLAIN' }
  | { type: 'PATCH' }
  | { type: 'REBUILD' }
  | { type: 'RETRIEVE' }
  | { type: 'TRANSFER' }
  | { type: 'DONE' }
  | { type: 'REVEAL' }
  | { type: 'RESET' };

export function initialLoopState(): LoopState {
  return {
    phase: 'predict', prediction: '', attempts: 0, lastRun: null,
    discrepancy: false, patchSaved: false, revealed: false, history: ['predict'],
  };
}

function move(state: LoopState, phase: LoopPhase): LoopState {
  return { ...state, phase, history: [...state.history, phase].slice(-24) };
}

function norm(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function loopReducer(state: LoopState, action: LoopAction): LoopState {
  switch (action.type) {
    case 'PREDICT':
      return { ...move(state, 'execute'), prediction: action.value };
    case 'EXECUTE': {
      const predicted = norm(state.prediction);
      const actual = norm(action.actual);
      const hasPrediction = predicted.length > 0;
      const discrepancy = hasPrediction && predicted !== actual;
      const next = move(state, discrepancy || !action.run.ok ? 'error' : 'explain');
      return { ...next, attempts: state.attempts + 1, lastRun: action.run, discrepancy };
    }
    case 'EXPLAIN': return move(state, 'patch');
    case 'PATCH': return { ...move(state, 'rebuild'), patchSaved: true };
    case 'REBUILD': return move(state, 'predict');
    case 'RETRIEVE': return move(state, 'retrieve');
    case 'TRANSFER': return move(state, 'transfer');
    case 'DONE': return move(state, 'done');
    case 'REVEAL': return { ...state, revealed: true };
    case 'RESET': return initialLoopState();
  }
}

export const PHASE_LABEL: Record<LoopPhase, string> = {
  predict: '予測する', execute: '実行する', error: '誤差を見る', explain: '理由を説明する',
  patch: '1行パッチ', rebuild: 'もう一度作る', retrieve: '時間を空けて思い出す',
  transfer: '類題に移す', done: '完了',
};

export const LOOP_ORDER: LoopPhase[] = ['predict', 'execute', 'error', 'explain', 'patch', 'rebuild', 'retrieve', 'transfer'];
