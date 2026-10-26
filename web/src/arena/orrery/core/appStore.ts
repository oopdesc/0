/**
 * Tiny external store. Keeps React out of the 60fps simulation loop and gives
 * one place for validation, persistence and cross-view navigation.
 */
import type { Dialect, ExecuteOutcome } from './lang';
import type { Challenge } from './lessons';
import { ALL_LESSONS, supportLevel } from './lessons';
import { defaultSnippet } from './lessons/snippets';
import {
  loadProgress, saveProgress, markComplete, recordAttempt, importProgress, exportProgress,
  defaultProgress, sanitiseProgress, type Preferences, type ProgressState,
} from './progress/store';
import { makePatch, addPatch } from './learning/patches';
import { newCard, schedule } from './learning/srs';
import { universe } from './simulation/controller';

export type Route = 'home' | 'lab' | 'learn' | 'errors' | 'galaxy' | 'review' | 'settings';

export interface LabState {
  dialect: Dialect;
  code: Record<Dialect, string>;
  prediction: string;
  result: ExecuteOutcome | null;
  snippetId: string;
}

export interface AppState {
  route: Route;
  progress: ProgressState;
  lab: LabState;
  lessonId: string;
  challengeIndex: number;
  reviewIndex: number;
  toast: string | null;
}

const ROUTES: Route[] = ['home', 'lab', 'learn', 'errors', 'galaxy', 'review', 'settings'];

function routeFromHash(): Route {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';
  return (ROUTES as string[]).includes(raw) ? (raw as Route) : 'home';
}

function initialState(): AppState {
  const progress = loadProgress();
  const java = defaultSnippet('java').code;
  const rust = defaultSnippet('rust').code;
  return {
    route: routeFromHash(),
    progress,
    lab: {
      dialect: progress.preferences.dialect,
      code: { java, rust },
      prediction: '',
      result: null,
      snippetId: defaultSnippet(progress.preferences.dialect).id,
    },
    lessonId: progress.lastLesson || ALL_LESSONS[0]!.id,
    challengeIndex: 0,
    reviewIndex: 0,
    toast: null,
  };
}

class AppStore {
  private state: AppState = initialState();
  private listeners = new Set<() => void>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        const route = routeFromHash();
        if (route !== this.state.route) this.set({ route });
      });
    }
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): AppState => this.state;

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const cb of this.listeners) cb();
  }

  private setProgress(next: ProgressState): void {
    this.state = { ...this.state, progress: next };
    saveProgress(next);
    for (const cb of this.listeners) cb();
  }

  navigate(route: Route): void {
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${route}`;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    this.set({ route });
  }

  setLabDialect(dialect: Dialect): void {
    const code = this.state.lab.code;
    const snippet = defaultSnippet(dialect);
    this.set({ lab: { ...this.state.lab, dialect, snippetId: snippet.id } });
    void code;
    this.setPreference({ dialect });
  }

  setLabCode(code: string): void {
    const lab = this.state.lab;
    this.set({ lab: { ...lab, code: { ...lab.code, [lab.dialect]: code } } });
  }

  setLabSnippet(id: string, code: string, dialect: Dialect): void {
    const lab = this.state.lab;
    this.set({
      lab: {
        ...lab, dialect, snippetId: id, prediction: '', result: null,
        code: { ...lab.code, [dialect]: code },
      },
    });
  }

  setLabPrediction(prediction: string): void {
    this.set({ lab: { ...this.state.lab, prediction } });
  }

  setLabResult(result: ExecuteOutcome | null): void {
    this.set({ lab: { ...this.state.lab, result } });
  }

  gotoLesson(lessonId: string, index = 0): void {
    this.set({ lessonId, challengeIndex: index, route: 'learn' });
    if (typeof window !== 'undefined') window.location.hash = '#/learn';
    this.setProgress({ ...this.state.progress, lastLesson: lessonId });
  }

  setChallengeIndex(index: number): void {
    this.set({ challengeIndex: index });
  }

  setPreference(patch: Partial<Preferences>): void {
    const prefs = { ...this.state.progress.preferences, ...patch };
    this.setProgress({ ...this.state.progress, preferences: prefs });
    if ('reducedMotion' in patch) universe.setReducedMotion(Boolean(patch.reducedMotion));
    if ('quality' in patch && patch.quality) universe.setQuality(patch.quality);
    if ('showGrid' in patch) universe.setGrid(Boolean(patch.showGrid));
    if ('timeScale' in patch && typeof patch.timeScale === 'number') universe.setTimeScale(patch.timeScale);
  }

  setToast(message: string | null): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.set({ toast: message });
    if (message) {
      this.toastTimer = setTimeout(() => this.set({ toast: null }), 3600);
    }
  }

  /** Record an attempt, save the one-line patch on failure, and schedule review. */
  recordChallengeAttempt(challenge: Challenge, prediction: string, actual: string, passed: boolean): void {
    let next = recordAttempt(this.state.progress, challenge.id, prediction, actual, passed);
    if (passed) {
      next = markComplete(next, challenge.id, findLessonId(challenge.id), supportLevel(challenge.kind));
    }
    const existing = next.review[challenge.id] ?? newCard(challenge.id);
    next = { ...next, review: { ...next.review, [challenge.id]: schedule(existing, passed ? 2 : 0) } };
    this.setProgress(next);
  }

  savePatch(challenge: Challenge): void {
    const patch = makePatch(challenge.patch, challenge.concept, challenge.id);
    this.setProgress({ ...this.state.progress, patches: addPatch(this.state.progress.patches, patch) });
    this.setToast('1行パッチを保存しました');
  }

  gradeReview(id: string, grade: 0 | 1 | 2): void {
    const card = this.state.progress.review[id] ?? newCard(id);
    this.setProgress({
      ...this.state.progress,
      review: { ...this.state.progress.review, [id]: schedule(card, grade) },
    });
  }

  setReviewIndex(i: number): void { this.set({ reviewIndex: i }); }

  toggleFavorite(lessonId: string): void {
    const cur = this.state.progress.favorites;
    const next = cur.includes(lessonId) ? cur.filter((x) => x !== lessonId) : [...cur, lessonId];
    this.setProgress({ ...this.state.progress, favorites: next });
  }

  importData(json: string): { ok: boolean; error?: string } {
    const result = importProgress(json);
    if (!result.ok || !result.state) return { ok: false, error: result.error };
    this.setProgress(result.state);
    return { ok: true };
  }

  exportData(): string { return exportProgress(this.state.progress); }

  resetAll(): void {
    this.setProgress(defaultProgress());
    this.set({ lab: { ...this.state.lab, result: null, prediction: '' }, challengeIndex: 0, reviewIndex: 0 });
    universe.resetWorld();
    this.setToast('進捗をリセットしました');
  }
}

function findLessonId(challengeId: string): string {
  return ALL_LESSONS.find((l) => l.challenges.some((c) => c.id === challengeId))?.id ?? '';
}

export const store = new AppStore();
export { sanitiseProgress };
