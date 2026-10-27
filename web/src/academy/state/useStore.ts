/**
 * アプリ全体で 1 つの状態を共有する。React の外に置き、
 * useSyncExternalStore で購読する（Context の再描画を避ける）。
 */
import { useSyncExternalStore } from 'react';
import { applyAttempt, loadState, saveState, type State, type Attempt } from './store';

let state: State = loadState();
const listeners = new Set<() => void>();

function emit() {
  saveState(state);
  for (const l of listeners) l();
}

export function getState(): State {
  return state;
}

export function setState(updater: (s: State) => State) {
  state = updater(state);
  emit();
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function recordAttempt(a: {
  pid: string;
  ok: boolean;
  ms: number;
  role: Attempt['role'];
  surface: string;
  concepts: string[];
  cause?: string;
}) {
  setState((s) => applyAttempt(s, a));
}

export function setTheme(theme: State['theme']) {
  setState((s) => ({ ...s, theme }));

}

export function setPref<K extends 'reduceMotion' | 'spaceQuality'>(key: K, value: State[K]) {
  setState((s) => ({ ...s, [key]: value }));
}

export function replaceState(next: State) {
  state = next;
  emit();
}

export function pinToday(ids: string[], date: string) {
  setState((s) => ({ ...s, today: { date, ids } }));
}

/* ── My Rules（1 行ルールの保存） ─────────────────── */

/** 同じ文言のルールは増やさず、保存日時だけ更新する（重複を溜めない）。 */
export function saveRule(r: { pid: string; text: string; concept?: string }) {
  setState((s) => {
    const same = s.rules.find((x) => x.text === r.text);
    if (same) {
      return { ...s, rules: s.rules.map((x) => (x.id === same.id ? { ...x, at: Date.now(), pid: r.pid } : x)) };
    }
    const id = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return { ...s, rules: [{ id, pid: r.pid, text: r.text, at: Date.now(), uses: 0, ...(r.concept ? { concept: r.concept } : {}) }, ...s.rules].slice(0, 200) };
  });
}

export function removeRule(id: string) {
  setState((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== id) }));
}

/** ルールを見ながら問題を解いた記録（rule の uses を増やす）。 */
export function markRuleUsed(id: string) {
  setState((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, uses: r.uses + 1 } : r)) }));
}
