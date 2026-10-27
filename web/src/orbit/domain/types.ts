export const LESSON_IDS = ['java-array', 'java-stream', 'java-polymorphism', 'rust-ownership', 'rust-option', 'rust-result'] as const;
export type LessonId = typeof LESSON_IDS[number];
export type Language = 'Java' | 'Rust';
export type BaseStage = 'example' | 'experiment' | 'recall' | 'transfer';
export type Stage = BaseStage | 'fill' | 'reorder' | 'partial';

export interface ConceptStructure {
  input: string;
  decision: string;
  process: string;
  output: string;
  role: string;
  invariant: string;
  boundary: string;
}
export interface Lesson {
  id: LessonId;
  number: string;
  language: Language;
  tag: string;
  title: string;
  short: string;
  goal: string;
  editGuide: string;
  patch: string;
  explanation: string;
  comparison: string;
  structure: ConceptStructure;
  sources: Record<BaseStage, string>;
  stagePrompts: Record<BaseStage, string>;
  reviewCode: string;
  reviewPrompt: string;
  rebuildPrompt: string;
}
export interface TraceStep {
  index: number;
  label: string;
  state: string;
}
export interface ModelState {
  radii: number[];
  highlightedIndex: number | null;
}
export interface RunResult {
  status: 'success' | 'language-error' | 'unsupported';
  output: string;
  actual: string;
  explanation: string;
  patch: string;
  trace: TraceStep[];
  model: ModelState | null;
  facts: Record<string, string | number | number[]>;
}
