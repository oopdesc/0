import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLines, compareOutput, textToLines } from '../../src/learning-v2/comparison';
import { gradeCodeAnswer } from '../../src/academy/lib/gradeCode';
import { isCorrect } from '../../src/academy/components/DiffView';
import type { Problem as AcademyProblem } from '../../src/academy/content/types';
import { JAVA_PROBLEMS } from '../../src/problems';
import { judgeLegacyAnswer, makeVariants } from '../../src/problems/schema';

test('exact output preserves lines, spaces, case and Unicode; tolerates a terminal CRLF', () => {
  assert.equal(compareOutput('1\n2\n', ['1', '2']), true);
  assert.equal(compareOutput('1\r\n2\r\n', ['1', '2']), true);
  assert.equal(compareOutput('1 2', ['1', '2']), false);
  assert.equal(compareOutput('A', ['a']), false);
  assert.equal(compareOutput('Ａ', ['A']), false);
  assert.equal(compareOutput('x ', ['x']), false);
  assert.deepEqual(textToLines(''), []);
  assert.deepEqual(textToLines('\n'), ['']);
  assert.equal(compareLines(['1.001'], ['1'], 'numeric'), false);
  assert.equal(compareLines(['1.001'], ['1'], 'numeric', 0.002), true);
  assert.equal(compareLines(['1 2'], ['1', '2'], 'tokens'), true);
});

test('Rust lint-only code is ungraded and cannot pass through the legacy view', () => {
  const p = {
    lang: 'rust', answer: { mode: 'code', reference: 'fn f() {}', lint: {} },
  } as AcademyProblem;
  const grade = gradeCodeAnswer(p, 'not valid Rust');
  assert.equal(grade.ran, false);
  assert.equal(grade.ok, false);
  assert.equal(isCorrect(p, { kind: 'code', text: 'not valid Rust' }), false);
});

test('a subset parser rejection is not described as a javac failure or a pass', () => {
  const p = {
    lang: 'java', answer: { mode: 'code', reference: 'static int f(int a) { return a; }',
      tests: [{ input: '1', expectOutput: ['1'] }] },
  } as AcademyProblem;
  const grade = gradeCodeAnswer(p, 'static int f(int a) { return switch (a) { default -> 1; }; }');
  assert.equal(grade.ran, false);
  assert.equal(grade.ok, false);
  assert.match(grade.notes.join(' '), /学習用エンジン/);
  assert.doesNotMatch(grade.notes.join(' '), /コンパイルエラー:/);
});

test('legacy output accepts two separate lines, not a whitespace-collapsed line', () => {
  const base = JAVA_PROBLEMS.find(p => p.id === 'jv1')!;
  const p = { ...base, expected: { output: ['1', '2'], verifiedBy: 'fixture' } };
  assert.equal(judgeLegacyAnswer(p, '1\n2'), true);
  assert.equal(judgeLegacyAnswer(p, '1 2'), false);
});

test('jv1 repaired variant keeps prompt, options, answer, code and explanation in agreement', () => {
  const base = JAVA_PROBLEMS.find(p => p.id === 'jv1')!;
  const [v] = makeVariants(base, 'test');
  assert.ok(v);
  assert.match(v.code!, /11 \/ 4/);
  assert.deepEqual(v.expected?.output, ['2']);
  assert.equal(v.answer, '2');
  assert.ok(v.prediction.options?.includes('2'));
  assert.match(v.explanation, /2\.75/);
  assert.match(v.explanation, / 2 /);
  assert.equal(judgeLegacyAnswer(v, '2'), true);
  assert.equal(judgeLegacyAnswer(v, '3'), false);
});
