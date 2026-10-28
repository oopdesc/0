import type { Alias, Concept, Diagnostic, Exam, Flow, Lang, Manifest, Project, Question } from './types';

/** Pack paths must remain relative and cannot contain URL syntax, encoded segments, or .. */
export function safePackPath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 240 && value.endsWith('.json') &&
    /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/.test(value) &&
    value.split('/').every(segment => segment !== '.' && segment !== '..');
}
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const safeContractId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(x) && !['__proto__','prototype','constructor'].includes(x);
const count = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 100_000;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 100_000 && x.every(v => typeof v === 'string' && v.length <= 200);

async function fetchJSON(lang: Lang, file: string, signal?: AbortSignal): Promise<unknown> {
  if (!safePackPath(file)) throw new Error('教材の相対パスが不正です。');
  const response = await fetch(`/learning-v2/${lang}/${file}`, { signal });
  if (!response.ok) throw new Error(`教材を読み込めません（HTTP ${response.status}）。`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 2_000_000) throw new Error('教材ファイルが大きすぎます。');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 2_000_000) throw new Error('教材ファイルが大きすぎます。');
  try { return JSON.parse(text) as unknown; } catch { throw new Error('教材のJSONを読み取れません。'); }
}

export function validateManifest(input: unknown, language: Lang): Manifest {
  if (!isObject(input) || input.schema !== 'zero-learning-pack/1' || input.language !== language ||
      typeof input.baseCommit !== 'string' || !/^[0-9a-f]{40}$/.test(input.baseCommit) ||
      typeof input.contentVersion !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(input.contentVersion) ||
      !isObject(input.counts) || !count(input.counts.normal) || !count(input.counts.writing) || !count(input.counts.exams) || !count(input.counts.projects) ||
      input.counts.writing > input.counts.normal || !Array.isArray(input.chunks) || input.chunks.length > 5000) throw new Error('manifestの形式が不正です。');
  const seen = new Set<string>();
  const chunks = input.chunks;
  for (const chunk of chunks) {
    if (!isObject(chunk) || !safePackPath(chunk.path) || !strings(chunk.ids) || chunk.ids.length > 5000) throw new Error('教材索引が不正です。');
    const chunkIds = chunk.ids;
    if (chunk.writingIds !== undefined && (!strings(chunk.writingIds) || new Set(chunk.writingIds).size !== chunk.writingIds.length || chunk.writingIds.some(id => !chunkIds.includes(id)))) throw new Error('記述問題の索引が不正です。');
    for (const id of chunk.ids) {
      if (!new RegExp(`^${language}:q[0-9]{4,}$`).test(id) || seen.has(id)) throw new Error('問題IDの重複または不正があります。');
      seen.add(id);
    }
  }
  if (seen.size !== input.counts.normal) throw new Error('教材数と索引が一致しません。');
  for (const key of ['conceptsPath', 'examsPath', 'flowsPath', 'projectsPath', 'aliasesPath']) if (!safePackPath(input[key])) throw new Error('教材参照先が不正です。');
  if (input.extensions !== undefined && !isObject(input.extensions)) throw new Error('教材の拡張情報が不正です。');
  if (isObject(input.extensions) && input.extensions.units !== undefined) {
    if (!Array.isArray(input.extensions.units) || input.extensions.units.length > chunks.length || input.extensions.units.some(u => !isObject(u) || typeof u.id !== 'string' || typeof u.title !== 'string' || typeof u.summary !== 'string' || !safePackPath(u.path) || !chunks.some(c => isObject(c) && c.path === u.path))) throw new Error('単元情報が不正です。');
  }
  return input as unknown as Manifest;
}
export async function loadManifest(language: Lang, signal?: AbortSignal): Promise<Manifest> {
  return validateManifest(await fetchJSON(language, 'manifest.json', signal), language);
}
function validateQuestionArray(data: unknown, ids: string[], language: Lang): Question[] {
  if (!Array.isArray(data) || data.length !== ids.length) throw new Error('単元の件数が索引と一致しません。');
  for (let i = 0; i < data.length; i++) {
    const q: unknown = data[i];
    if (!isObject(q) || q.id !== ids[i] || q.language !== language || typeof q.title !== 'string' ||
        typeof q.prompt !== 'string' || typeof q.contentVersion !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(q.contentVersion) ||
        !isObject(q.setup) || !Array.isArray(q.setup.files) || (q.writingRequired === true && !q.setup.files.length) || typeof q.setup.entryPoint !== 'string' || typeof q.setup.languageVersion !== 'string' || typeof q.setup.note !== 'string' || !strings(q.setup.dependencies) ||
        q.setup.files.some(f => !isObject(f) || typeof f.path !== 'string' || !/^[A-Za-z0-9._/-]{1,200}$/.test(f.path) || f.path.startsWith('/') || f.path.split('/').some(p => p === '..' || p === '.') || typeof f.content !== 'string' || f.content.length > 100_000 || typeof f.editable !== 'boolean') ||
        !isObject(q.answer) || !['choice','multichoice','output','trace','order','code'].includes(String(q.answer.mode)) || !['exact-lines','tokens','numeric'].includes(String(q.answer.comparison)) ||
        !Array.isArray(q.answer.options) || !q.answer.options.every(o => isObject(o) && typeof o.id === 'string' && typeof o.text === 'string') || !strings(q.answer.correctOptionIds) || !strings(q.answer.expectedOutput) || !Array.isArray(q.answer.orderItems) || !q.answer.orderItems.every(o => isObject(o) && typeof o.id === 'string' && typeof o.text === 'string') || !strings(q.answer.correctOrderIds) ||
        !isObject(q.solution) || typeof q.solution.explanation !== 'string' || !strings(q.solution.reasoningSteps) || !strings(q.solution.boundaries) || !strings(q.solution.alternativeCriteria) ||
        !Array.isArray(q.solution.files) || !q.solution.files.every(f => isObject(f) && typeof f.path === 'string' && typeof f.content === 'string' && typeof f.editable === 'boolean') ||
        !Array.isArray(q.solution.wrongReasons) || !q.solution.wrongReasons.every(r => isObject(r) && typeof r.optionId === 'string' && typeof r.reason === 'string') ||
        !Array.isArray(q.solution.references) || !q.solution.references.every(r => isObject(r) && typeof r.title === 'string' && typeof r.url === 'string') ||
        !Array.isArray(q.hints) || !q.hints.every(h => isObject(h) && typeof h.id === 'string' && typeof h.text === 'string' && typeof h.revealsAnswer === 'boolean') ||
        !Array.isArray(q.tests) || !q.tests.every(t => isObject(t) && typeof t.id === 'string' && Array.isArray(t.cases) && t.cases.every(c => isObject(c) && typeof c.id === 'string' && typeof c.stdin === 'string' && strings(c.expectedStdout))) ||
        !strings(q.conceptIds) || !strings(q.prerequisiteConceptIds) || !strings(q.relatedIds) || !strings(q.transferIds) || typeof q.writingRequired !== 'boolean' ||
        !isObject(q.evidence) || typeof q.evidence.specReviewed !== 'boolean') throw new Error(`問題データ ${ids[i]} が不正です。`);
    const answer = q.answer as Record<string, unknown>;
    const optionIds = (answer.options as {id:string}[]).map(o => o.id);
    if (new Set(optionIds).size !== optionIds.length || !(answer.correctOptionIds as string[]).every(id => optionIds.includes(id))) throw new Error(`選択肢 ${ids[i]} が不正です。`);
  }
  return data as Question[];
}
export async function loadChunk(manifest: Manifest, chunkPath: string, signal?: AbortSignal): Promise<Question[]> {
  const chunk = manifest.chunks.find(c => c.path === chunkPath);
  if (!chunk) throw new Error('索引にない単元です。');
  return validateQuestionArray(await fetchJSON(manifest.language, chunk.path, signal), chunk.ids, manifest.language);
}

/** Diagnostics reuse already-indexed normal questions and do not change their count. */
export function getDiagnostics(manifest: Manifest): Diagnostic[] {
  const data: unknown = manifest.extensions?.diagnostics;
  if (data === undefined) return [];
  if (!Array.isArray(data) || data.length > 20) throw new Error('診断の索引が不正です。');
  const ids = new Set<string>();
  for (const d of data) {
    if (!isObject(d) || !safeContractId(d.id) || ids.has(d.id) || typeof d.title !== 'string' || !d.title.trim() || d.title.length > 200 || typeof d.description !== 'string' || d.description.length > 1000 || !['beginner','intermediate','advanced'].includes(String(d.level)) || !strings(d.questionIds) || d.questionIds.length < 1 || d.questionIds.length > 20 || new Set(d.questionIds).size !== d.questionIds.length || d.questionIds.some(id => !manifest.chunks.some(c => c.ids.includes(id)))) throw new Error('診断の問題IDまたは項目が不正です。');
    ids.add(d.id);
  }
  return data as Diagnostic[];
}
export async function loadDiagnosticQuestions(manifest: Manifest, diagnostic: Diagnostic, signal?: AbortSignal): Promise<Question[]> {
  const indexed = getDiagnostics(manifest).find(d => d.id === diagnostic.id);
  if (!indexed || JSON.stringify(indexed.questionIds) !== JSON.stringify(diagnostic.questionIds)) throw new Error('索引にない診断です。');
  const byId = new Map<string, Question>();
  // Deliberately sequential: never request more than one chunk at once.
  for (const chunk of manifest.chunks.filter(c => c.ids.some(id => diagnostic.questionIds.includes(id)))) {
    for (const q of await loadChunk(manifest, chunk.path, signal)) byId.set(q.id, q);
  }
  const ordered = diagnostic.questionIds.map(id => byId.get(id));
  if (ordered.some(q => !q || q.level !== diagnostic.level || q.writingRequired || q.answer.mode !== 'choice' || q.answer.correctOptionIds.length !== 1)) throw new Error('この診断には未対応または不正な問題があります。');
  return ordered as Question[];
}

async function arrayResource<T>(manifest: Manifest, path: string, signal?: AbortSignal): Promise<T[]> {
  const value = await fetchJSON(manifest.language, path, signal);
  if (!Array.isArray(value) || value.length > 100_000) throw new Error('教材の配列が不正です。');
  return value as T[];
}
export async function loadConcepts(m: Manifest, signal?: AbortSignal): Promise<Concept[]> {
  const values = await arrayResource<unknown>(m, m.conceptsPath, signal);
  if (values.some(c => !isObject(c) || typeof c.id !== 'string' || c.language !== m.language || typeof c.name !== 'string' || typeof c.summary !== 'string' || !strings(c.hardPrerequisiteIds) || !strings(c.introducedBy) || !strings(c.problemIds))) throw new Error('概念データが不正です。');
  return values as Concept[];
}
export async function loadAliases(m: Manifest, signal?: AbortSignal): Promise<Alias[]> {
  const values = await arrayResource<unknown>(m, m.aliasesPath, signal);
  const keys = new Set<string>();
  for (const a of values) {
    if (!isObject(a) || !['academy','practice'].includes(String(a.source)) || typeof a.id !== 'string' || a.id.length > 120 || typeof a.targetId !== 'string' || !new RegExp(`^${m.language}:q[0-9]{4,}$`).test(a.targetId) || !m.chunks.some(c => c.ids.includes(a.targetId as string))) throw new Error('旧IDの対応が不正です。');
    const key = `${a.source}:${a.id}`; if (keys.has(key)) throw new Error('旧IDの対応が重複しています。'); keys.add(key);
  }
  return values as Alias[];
}
export async function loadExams(m: Manifest, signal?: AbortSignal): Promise<Exam[]> {
  const values = await arrayResource<unknown>(m, m.examsPath, signal);
  if (values.length !== m.counts.exams || values.some(e => !isObject(e) || !safeContractId(e.id) || e.language !== m.language || !['beginner','intermediate','advanced'].includes(String(e.level)) || !['A','B'].includes(String(e.form)) || !count(e.durationMinutes) || e.durationMinutes === 0 || (e.durationMinutes as number) > 480 || !count(e.passingPercent) || (e.passingPercent as number) > 100 || !strings(e.choiceQuestionIds) || !strings(e.codeQuestionIds) || !safePackPath(e.questionsPath))) throw new Error('試験データが不正です。');
  const examIds = new Set<string>(), questionIds = new Set<string>();
  for (const exam of values as Exam[]) {
    if (examIds.has(exam.id)) throw new Error('試験IDが重複しています。'); examIds.add(exam.id);
    for (const id of [...exam.choiceQuestionIds, ...exam.codeQuestionIds]) {
      if (!safeContractId(id) || questionIds.has(id) || m.chunks.some(c => c.ids.includes(id))) throw new Error('試験問題IDが重複または不正です。');
      questionIds.add(id);
    }
  }
  return values as Exam[];
}
export async function loadExamQuestions(m: Manifest, exam: Exam, signal?: AbortSignal): Promise<Question[]> {
  const ids = [...exam.choiceQuestionIds, ...exam.codeQuestionIds];
  if (exam.language !== m.language || !safePackPath(exam.questionsPath) || !ids.length || ids.length > 200 || new Set(ids).size !== ids.length || ids.some(id => !safeContractId(id) || m.chunks.some(c => c.ids.includes(id)))) throw new Error('試験の索引が不正です。');
  const input = await fetchJSON(m.language, exam.questionsPath, signal);
  if (!Array.isArray(input) || input.length !== ids.length || input.some(q => !isObject(q) || typeof q.id !== 'string') || new Set(input.map(q => q.id)).size !== ids.length) throw new Error('試験問題の件数が一致しません。');
  const ordered = ids.map(id => input.find(q => q.id === id));
  const questions = validateQuestionArray(ordered, ids, m.language);
  if (questions.some(q => exam.choiceQuestionIds.includes(q.id) ? !['choice','multichoice'].includes(q.answer.mode) || q.writingRequired || q.answer.options.length < 2 || !q.answer.correctOptionIds.length || (q.answer.mode === 'choice' && q.answer.correctOptionIds.length !== 1) : q.answer.mode !== 'code' || !q.writingRequired)) throw new Error('試験の選択と記述の区分が不正です。');
  return questions;
}
export function safeSourceRef(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 240 && /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:java|rs|md|txt)$/.test(value) && value.split('/').every(segment => segment !== '.' && segment !== '..');
}
export async function loadFlows(m: Manifest, signal?: AbortSignal): Promise<Flow[]> {
  const values = await arrayResource<unknown>(m, m.flowsPath, signal);
  if (values.some(f => !isObject(f) || typeof f.id !== 'string' || f.language !== m.language || typeof f.title !== 'string' || !strings(f.problemIds) || !Array.isArray(f.steps) || !f.steps.length || f.steps.some(s => !isObject(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || typeof s.explanation !== 'string' || !safeSourceRef(s.sourceRef) || !isObject(s.variables) || !Object.values(s.variables).every(v => typeof v === 'string') || !(s.status === null || count(s.status))))) throw new Error('処理フローが不正です。');
  return values as Flow[];
}
export async function loadProjects(m: Manifest, signal?: AbortSignal): Promise<Project[]> {
  const values = await arrayResource<unknown>(m, m.projectsPath, signal);
  const ids = new Set<string>();
  const validId = (value: unknown) => typeof value === 'string' && value.startsWith(`${m.language}:`) && /^[a-z]+:[A-Za-z0-9._-]{1,100}$/.test(value) && !ids.has(value);
  if (values.length !== m.counts.projects) throw new Error('プロジェクト数がmanifestと一致しません。');
  for (const p of values) {
    if (!isObject(p) || !validId(p.id) || p.language !== m.language || typeof p.title !== 'string' || !Array.isArray(p.missions) || p.missions.length > 100 || (p.extensions !== undefined && (!isObject(p.extensions) || (p.extensions.status !== undefined && typeof p.extensions.status !== 'string') || (p.extensions.note !== undefined && typeof p.extensions.note !== 'string')))) throw new Error('プロジェクト情報が不正です。');
    ids.add(p.id as string);
    for (const mission of p.missions) {
      if (!isObject(mission) || !validId(mission.id) || typeof mission.title !== 'string' || typeof mission.instructions !== 'string' || !strings(mission.prerequisiteConceptIds) ||
          !Array.isArray(mission.files) || mission.files.length > 40 || mission.files.some(f => !isObject(f) || !safeSourceRef(f.path) || typeof f.content !== 'string' || f.content.length > 100_000 || typeof f.editable !== 'boolean') ||
          !strings(mission.acceptance) || !strings(mission.testCommand) || !strings(mission.hints) || typeof mission.solutionDiff !== 'string' || mission.solutionDiff.length > 200_000 || typeof mission.explanation !== 'string') throw new Error('プロジェクトの小課題が不正です。');
      ids.add(mission.id as string);
    }
  }
  return values as Project[];
}
