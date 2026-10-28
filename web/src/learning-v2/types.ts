export type Lang = 'java' | 'rust';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type SourceFile = { path: string; content: string; editable: boolean };
export type Diagnostic = { id: string; title: string; level: Level; description: string; questionIds: string[] };
export type Manifest = {
  schema: 'zero-learning-pack/1'; language: Lang; baseCommit: string; contentVersion: string;
  counts: { normal: number; writing: number; exams: number; projects: number };
  chunks: { path: string; ids: string[]; writingIds?: string[] }[];
  conceptsPath: string; examsPath: string; flowsPath: string; projectsPath: string; aliasesPath: string;
  extensions?: { units?: { id: string; title: string; summary: string; path: string }[]; diagnostics?: Diagnostic[]; [key: string]: unknown };
};
export type Question = {
  id: string; language: Lang; contentVersion: string; unitId: string; order: number; level: Level;
  kind: 'choice' | 'multichoice' | 'output' | 'trace' | 'fix' | 'code' | 'order';
  title: string; prompt: string; conceptIds: string[]; prerequisiteConceptIds: string[]; introducesConceptIds: string[];
  setup: { files: SourceFile[]; entryPoint: string; languageVersion: string; edition: string | null; dependencies: string[]; note: string };
  prediction?: { prompt: string; options: { id: string; text: string }[] }; starter?: string;
  answer: { mode: 'choice' | 'multichoice' | 'output' | 'trace' | 'order' | 'code'; options: { id: string; text: string }[]; correctOptionIds: string[]; expectedOutput: string[]; comparison: 'exact-lines' | 'tokens' | 'numeric'; orderItems: { id: string; text: string }[]; correctOrderIds: string[] };
  solution: { files: SourceFile[]; explanation: string; reasoningSteps: string[]; wrongReasons: { optionId: string; reason: string }[]; boundaries: string[]; alternativeCriteria: string[]; references: { title: string; url: string }[] };
  hints: { id: string; text: string; revealsAnswer: boolean }[]; writingRequired: boolean;
  tests: { id: string; mode: 'stdio' | 'harness'; testFiles: SourceFile[]; cases: { id: string; stdin: string; expectedStdout: string[]; expectedExit: number; expectedCompile: 'pass' | 'fail'; errorContains: string[] }[] }[];
  runnerProfile: string | null; relatedIds: string[]; transferIds: string[];
  evidence: { specReviewed: boolean; compilerRun: null | { tool: string; version: string; sourceSha256: string; status: string; stdout: string[]; checkedAt: string }; browserRun: null | { checks: string[]; checkedAt: string } };
  legacyRefs: { source: 'academy' | 'practice'; id: string }[];
  extensions?: Record<string, unknown>;
};
export type Concept = { id: string; language: Lang; name: string; summary: string; minimalExample: string; hardPrerequisiteIds: string[]; relatedIds: string[]; introducedBy: string[]; problemIds: string[] };
export type Alias = { source: 'academy' | 'practice'; id: string; targetId: string };
export type Exam = { id: string; language: Lang; level: Level; form: 'A' | 'B'; durationMinutes: number; passingPercent: number; choiceQuestionIds: string[]; codeQuestionIds: string[]; questionsPath: string; extensions?: { reviewSelection?: boolean; note?: string } };
export type Flow = { id: string; language: Lang; title: string; steps: { id: string; label: string; explanation: string; sourceRef: string; variables: Record<string, string>; status: number | null }[]; problemIds: string[] };
export type Project = {
  id: string; language: Lang; title: string; extensions?: { status?: string; note?: string };
  missions: {
    id: string; title: string; prerequisiteConceptIds: string[]; instructions: string; files: SourceFile[];
    acceptance: string[]; testCommand: string[]; hints: string[]; solutionDiff: string; explanation: string;
  }[];
};
