import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { loadManifest, loadChunk, loadConcepts, loadAliases, loadExams, loadExamQuestions, loadFlows, loadProjects } from '../src/learning-v2/loader';

const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  assert.match(url, /^\/learning-v2\/(java|rust)\/[A-Za-z0-9._/-]+$/);
  const file = path.resolve(root, '.' + url);
  assert.ok(file.startsWith(root + path.sep));
  const body = await readFile(file);
  const size = (await stat(file)).size;
  return new Response(body, { headers: { 'content-length': String(size), 'content-type': 'application/json' } });
}) as typeof fetch;

for (const language of ['java', 'rust'] as const) {
  const manifest = await loadManifest(language);
  let total = 0, writing = 0;
  const concepts = await loadConcepts(manifest);
  const conceptIds = new Set(concepts.map(c => c.id));
  let missingConcepts = 0;
  for (const chunk of manifest.chunks) {
    const questions = await loadChunk(manifest, chunk.path);
    total += questions.length;
    for (const q of questions) {
      assert.ok(q.prompt.trim() && q.solution.explanation.trim(), q.id);
      assert.ok(q.solution.reasoningSteps.length, q.id);
      writing += Number(q.writingRequired);
      missingConcepts += q.prerequisiteConceptIds.filter(id => !conceptIds.has(id)).length;
      if (q.answer.mode === 'choice') assert.equal(q.answer.correctOptionIds.length, 1, q.id);
      if (q.writingRequired && !q.runnerProfile) assert.ok(q.extensions?.localGradingDisabledReason, q.id);
      const ids = q.answer.options.map(o => o.id);
      assert.equal(ids.length, new Set(ids).size, q.id);
    }
  }
  assert.equal(total, manifest.counts.normal);
  assert.equal(writing, manifest.counts.writing);
  await loadAliases(manifest);
  const exams = await loadExams(manifest);
  let examQuestions = 0;
  for (const exam of exams) examQuestions += (await loadExamQuestions(manifest, exam)).length;
  await loadFlows(manifest); await loadProjects(manifest);
  console.log(JSON.stringify({ language, total, writing, exams: exams.length, examQuestions, missingConcepts }));
  assert.equal(missingConcepts, 0, 'Unresolved prerequisite concepts');
}
