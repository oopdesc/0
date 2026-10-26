export type Language = 'java' | 'rust';
export type SceneKind = 'galaxy' | 'orbit' | 'ownership' | 'trajectory';
export type AppView = 'workspace' | 'atlas' | 'errors' | 'review' | 'compare';
export type LearningStage = 'observe' | 'trace' | 'predict' | 'patch' | 'experiment' | 'recall' | 'transfer';
export type QualityPreset = 'auto' | 'high' | 'balanced' | 'battery';
export type PredictionId = string;
export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

export interface SimulationParams {
  stabilityLimit: number;
  radiusFloor: number;
  eccentricity: number;
  particleCount: number;
  brightnessFloor: number;
  selectedBody: 'planet' | 'star';
  handoff: boolean;
  orbitRadius: number;
}

export interface ModelTelemetry {
  label: string;
  value: string;
  detail?: string;
}

export interface ModelReport {
  status: 'ok' | 'error';
  headline: string;
  output: string[];
  explanation: string;
  highlightedIds: string[];
  telemetry: ModelTelemetry[];
  activeLine: number;
}

export interface TraceStep {
  line: number;
  label: string;
  state: string;
  telemetry: string;
}

export interface LessonQuestion {
  prompt: string;
  choices: { id: PredictionId; label: string }[];
  correctId: PredictionId;
  actual: string;
  explanation: string;
}

export interface LessonPatch {
  prompt: string;
  answer: string;
  accepted: string[];
  hint: string;
  rule: string;
  fixedLine: string;
  brokenLine: string;
}

export interface ConceptModel {
  input: string;
  decision: string;
  process: string;
  result: string;
  role: string;
  invariant: string;
  boundary: string;
}

export interface ParameterSpec {
  key: keyof SimulationParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
}

export interface Lesson {
  id: string;
  language: Language;
  module: string;
  title: string;
  titleEn: string;
  subtitle: string;
  level: 'FOUNDATION' | 'BRIDGE' | 'DEEPEN';
  duration: string;
  scene: SceneKind;
  conceptTag: string;
  objective: string;
  code: string;
  sourcePath: string;
  trace: TraceStep[];
  question: LessonQuestion;
  patch: LessonPatch;
  concept: ConceptModel;
  parameter: ParameterSpec;
  transfer: {
    prompt: string;
    choices: { id: string; label: string }[];
    correctId: string;
    explanation: string;
  };
  modelNote: string;
}

export interface LessonRecord {
  attempts: number;
  correctPredictions: number;
  incorrectPredictions: number;
  successStreak: number;
  bestStreak: number;
  lastStudiedAt: number | null;
  dueAt: number | null;
  reviewCount: number;
  lastSelfRating: 'again' | 'hard' | 'good' | 'easy' | null;
}

export interface ErrorPatchRecord {
  id: string;
  lessonId: string;
  prompt: string;
  predicted: string;
  referenceOutcome: string;
  cause: string;
  fixedLine: string;
  rule: string;
  createdAt: number;
  dueAt: number;
  reviewCount: number;
  lastRecalledAt: number | null;
}

export interface PersistedSettings {
  quality: QualityPreset;
  reducedMotionOverride: boolean | null;
  soundEnabled: false;
}

export interface AppState {
  schema: 1;
  lessonRecords: Record<string, LessonRecord>;
  errorPatches: ErrorPatchRecord[];
  favorites: string[];
  settings: PersistedSettings;
}
