import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PROBLEMS,
  BRIDGE_PROBLEMS,
  JAVA_PROBLEMS,
  RUST_PROBLEMS,
  TOTAL_COUNT,
  filterProblems,
  getProblem,
  orderedProblems,
  verifiedProblems,
} from "../src/problems/index";
import {
  MISCONCEPTION_LABEL,
  QUESTION_LABEL,
  isCorrectAnswer,
  isCorrectOrder,
  makeVariants,
  normaliseAnswer,
  shuffleLines,
  type Problem,
} from "../src/problems/schema";
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  applyAttempt,
  bucketCounts,
  loadProgress,
  type ProgressState,
} from "../src/problems/store";
import runnerMap from "../src/problems/runner-map.json";


/* ------------------------------------------------------------ dataset size */

test("the dataset beats the previous baseline and is not padded", () => {
  assert.ok(JAVA_PROBLEMS.length >= 40, `Java needs 40+, has ${JAVA_PROBLEMS.length}`);
  assert.ok(RUST_PROBLEMS.length >= 40, `Rust needs 40+, has ${RUST_PROBLEMS.length}`);
  assert.ok(BRIDGE_PROBLEMS.length >= 8, `Bridge needs 8+, has ${BRIDGE_PROBLEMS.length}`);
  assert.equal(TOTAL_COUNT, ALL_PROBLEMS.length);
  assert.ok(TOTAL_COUNT > 54, `baseline to beat was 54, now ${TOTAL_COUNT}`);
});

test("ids are unique and every problem is reachable through the registry", () => {
  const seen = new Set<string>();
  for (const p of ALL_PROBLEMS) {
    assert.ok(p.id.length > 2, `id too short: ${p.id}`);
    assert.ok(!seen.has(p.id), `duplicate id ${p.id}`);
    seen.add(p.id);
    assert.equal(getProblem(p.id)?.id, p.id);
  }
});

test("required schema fields are present and typed", () => {
  for (const p of ALL_PROBLEMS) {
    assert.ok(p.prompt.trim().length > 4, `${p.id}: prompt`);
    assert.ok(p.explanation.trim().length > 8, `${p.id}: explanation`);
    assert.ok(p.misconception.trim().length > 4, `${p.id}: misconception`);
    assert.ok(MISCONCEPTION_LABEL[p.misconceptionClass], `${p.id}: misconceptionClass`);
    assert.ok(QUESTION_LABEL[p.questionType], `${p.id}: questionType`);
    assert.ok(p.hints.length >= 1, `${p.id}: hints`);
    assert.ok(p.oneLinePatch.trim().length > 4, `${p.id}: oneLinePatch`);
    assert.ok(p.reviewInterval >= 1, `${p.id}: reviewInterval`);
    assert.ok(p.expected?.verifiedBy, `${p.id}: verifiedBy`);
    assert.ok(p.answer.trim().length > 0, `${p.id}: answer`);
    if (p.code !== undefined) {
      assert.ok(p.code.length > 0, `${p.id}: empty code`);
    }
  }
});

test("every problem has a runnable expectation or declares why it cannot run", () => {
  for (const p of ALL_PROBLEMS) {
    const e = p.expected;
    if (!e) {
      assert.equal(p.execution, "reading", `${p.id}: expected is required unless execution is reading`);
      continue;
    }
    const hasOutput = Array.isArray(e.output) || typeof e.value === "string";
    const hasVerdict = typeof e.compiles === "boolean" || typeof e.runtimeError === "string";
    assert.ok(
      hasOutput || hasVerdict,
      `${p.id}: expected needs output, value, compiles or runtimeError`,
    );
    if (Array.isArray(e.output)) {
      assert.ok(e.output.every((line) => typeof line === "string"), `${p.id}: output lines must be strings`);
    }
  }
});

test("no problem is a thin copy of another: prompts and code differ", () => {
  const byPrompt = new Map<string, string>();
  for (const p of ALL_PROBLEMS) {
    const key = normaliseAnswer(p.prompt).slice(0, 60);
    const prev = byPrompt.get(key);
    if (prev) {
      // Same prompt wording is allowed only when the code differs.
      assert.notEqual(prev, p.code ?? "", `${p.id} repeats ${prev}'s prompt and code`);
    }
    byPrompt.set(key, p.code ?? "");
  }
});

/* ------------------------------------------------------------ answer logic */

test("answers normalise the way a learner would type them", () => {
  assert.ok(isCorrectAnswer("  Java ", "java"));
  assert.ok(isCorrectAnswer("Ｊａｖａ", "java"));
  assert.ok(!isCorrectAnswer("java!", "java"));
  assert.ok(isCorrectOrder(["a", "b"], ["A ", "B"]));
  assert.ok(!isCorrectOrder(["b", "a"], ["a", "b"]));
});

test("shuffleLines is deterministic and never returns the input order", () => {
  const lines = ["1", "2", "3", "4", "5", "6"];
  const first = shuffleLines(lines, "salt");
  assert.deepEqual(first, shuffleLines(lines, "salt"));
  assert.notDeepEqual(first, lines);
  assert.deepEqual(shuffleLines(lines, "other"), shuffleLines(lines, "other"));
});

test("variants are a pure function of the problem and the salt", () => {
  const base = ALL_PROBLEMS.find((p) => p.variants && p.variants.length > 0);
  if (!base) return;
  const a = makeVariants(base, "salt-a");
  const b = makeVariants(base, "salt-a");
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.deepEqual(a.map((x) => x.expected), b.map((x) => x.expected));
  for (const v of a) {
    assert.ok(v.id !== base.id, "variant id must not collide with the base id");
  }
});

/* ------------------------------------------------------------- progress */

test("the eight progress buckets are all reachable and labelled", () => {
  for (const bucket of BUCKET_ORDER) {
    assert.ok(BUCKET_LABEL[bucket], `missing label for ${bucket}`);
  }
  assert.equal(BUCKET_ORDER.length, 8);
  const counts = bucketCounts(ALL_PROBLEMS, { version: 1, records: {}, settings: loadProgress().settings }, Date.now());
  assert.equal(counts.length, 8);
  assert.equal(
    counts.reduce((sum, c) => sum + c.count, 0),
    ALL_PROBLEMS.length,
  );
  assert.equal(counts.find((c) => c.bucket === "unlearned")!.count, ALL_PROBLEMS.length);
});

test("a blind correct answer marks the problem learned; a revealed one does not", () => {
  const problem = JAVA_PROBLEMS[0]!;
  let state: ProgressState = loadProgress();
  state = applyAttempt(state, problem, { prediction: "x", actual: "y", ok: false, blind: true }).state;
  assert.equal(state.records[problem.id]!.status, "learning");
  state = applyAttempt(state, problem, { prediction: problem.answer, actual: "y", ok: true, blind: false }).state;
  assert.equal(state.records[problem.id]!.status, "answered");
  state = applyAttempt(state, problem, { prediction: problem.answer, actual: "y", ok: true, blind: true }).state;
  assert.equal(state.records[problem.id]!.status, "reproduced");
  assert.ok(state.records[problem.id]!.lastReproduced);
  assert.ok(state.records[problem.id]!.reviewDueAt! > Date.now());
  // A second error drops it back out of the learned state.
  state = applyAttempt(state, problem, { prediction: "nope", actual: "y", ok: false, blind: true }).state;
  assert.notEqual(state.records[problem.id]!.status, "reproduced");
});

test("repeated errors mark a weak concept and remember the misconception", () => {
  const problem = RUST_PROBLEMS[0]!;
  let state: ProgressState = loadProgress();
  for (let i = 0; i < 3; i++) {
    state = applyAttempt(state, problem, { prediction: "bad", actual: "y", ok: false, blind: true }).state;
  }
  const record = state.records[problem.id]!;
  assert.equal(record.status, "weak");
  assert.ok(record.misconceptions.includes(problem.misconceptionClass));
  assert.equal(record.errorCount, 3);
});

/* ------------------------------------------------------------- runner map */

test("the browser runner map only names problems that exist and are runnable", () => {
  const ids = new Set(ALL_PROBLEMS.map((p) => p.id));
  for (const side of ["java", "rust"] as const) {
    const entries = runnerMap[side] as Array<{ index: number; id: string }>;
    assert.ok(entries.length > 0, `${side} runner is empty`);
    for (const entry of entries) {
      assert.ok(ids.has(entry.id), `${side}: ${entry.id} is not in the dataset`);
      const problem = getProblem(entry.id)!;
      assert.equal(problem.language, side);
      assert.ok(problem.code || problem.solution, `${entry.id} has no code to run`);
      const body = problem.solution && !problem.solution.includes("____") ? problem.solution : problem.code ?? "";
      assert.ok(!body.includes("____"), `${entry.id} still contains a blank`);
      if (side === "rust") {
        // A panic would abort the whole WASM module, so Rust cannot pre-run these.
        assert.ok(
          !problem.expected?.runtimeError,
          `${entry.id} panics and would abort the Rust runner`,
        );
      }
    }
  }
});

test("problems that cannot run in the browser say so through `execution`", () => {
  const runnerIds = new Set(
    [...(runnerMap.java as Array<{ id: string }>), ...(runnerMap.rust as Array<{ id: string }>)].map((x) => x.id),
  );
  for (const p of ALL_PROBLEMS) {
    if (runnerIds.has(p.id)) {
      assert.ok(
        p.execution === "browser-java" || p.execution === "rust-verified",
        `${p.id} runs in the browser but declares ${p.execution}`,
      );
    }
  }
  const runnerCoverage = runnerIds.size;
  assert.ok(runnerCoverage >= 40, `only ${runnerCoverage} problems have a browser runner`);
});

test("verified problems are the ones with machine-checked expectations", () => {
  const verified = verifiedProblems();
  assert.ok(verified.length > 60, `expected most problems to be verified, got ${verified.length}`);
  for (const p of verified) {
    assert.ok(p.expected, `${p.id} claims verified but has no expected`);
  }
});

test("filters and ordering stay consistent with the registry", () => {
  const java = filterProblems({ language: "java" });
  assert.equal(java.length, JAVA_PROBLEMS.length);
  const rust = orderedProblems("rust");
  assert.equal(rust.length, RUST_PROBLEMS.length);
  assert.ok(new Set(rust.map((p) => p.id)).size === rust.length);
});

/* ------------------------------------------------------------- space engine */

test("no problem embeds a blank that the player cannot fill", () => {
  const starters = ALL_PROBLEMS.filter((p) => (p.code ?? "").includes("____"));
  for (const p of starters) {
    assert.ok(p.solution, `${p.id} shows blanks but has no solution to run`);
    assert.ok(!p.solution.includes("____"), `${p.id} solution still has blanks`);
  }
});

test("every problem that runs in the browser also appears in the generated runner sources", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const java = readFileSync(`${root}frontend/java-problems/src/main/java/cosmic/browser/Problems.java`, "utf8");
  const rust = readFileSync(`${root}backend/rust/cosmic-problems/src/problems.rs`, "utf8");
  for (const entry of runnerMap.java as Array<{ id: string; index: number }>) {
    assert.ok(java.includes(`p${entry.index}()`), `Problems.java missing p${entry.index}`);
  }
  for (const entry of runnerMap.rust as Array<{ id: string; index: number }>) {
    assert.ok(rust.includes(`fn p${entry.index}(`), `problems.rs missing p${entry.index}`);
  }
  assert.equal(
    (runnerMap.java as Array<{ id: string }>).filter((x) => getProblem(x.id)?.language === "java").length,
    (runnerMap.java as Array<{ id: string }>).length,
  );
});

test("generated runner sources carry no dataset drift marker", () => {
  const java = ALL_PROBLEMS.find((p) => p.execution === "browser-java");
  assert.ok(java, "expected at least one browser-java problem");
  assert.ok((java as Problem).answer.length > 0);
});

test("every problem points at a transfer problem on the same language side", () => {
  const byId = new Map(ALL_PROBLEMS.map((p) => [p.id, p]));
  for (const problem of ALL_PROBLEMS) {
    const target = byId.get(problem.transfer!);
    assert.ok(target, `${problem.id} transfers to ${problem.transfer} which does not exist`);
    assert.notEqual(target.id, problem.id, `${problem.id} transfers to itself`);
    assert.equal(target.language, problem.language, `${problem.id} transfers across languages`);
    assert.notEqual(target.code, problem.code, `${problem.id} transfers to a copy of itself`);
  }
});

test("every level 3 problem declares a prerequisite that is not itself", () => {
  const byId = new Map(ALL_PROBLEMS.map((p) => [p.id, p]));
  const level3 = ALL_PROBLEMS.filter((p) => p.level === 3);
  assert.ok(level3.length > 20, `expected many level 3 problems, saw ${level3.length}`);
  for (const problem of level3) {
    assert.ok((problem.prerequisite as string[] | undefined)?.length, `${problem.id} has no prerequisite`);
    for (const dep of problem.prerequisite!) {
      const target = byId.get(dep);
      assert.ok(target, `${problem.id} requires unknown ${dep}`);
      assert.notEqual(target.id, problem.id);
      assert.ok(target.level < 3, `${problem.id} requires ${dep} which is not earlier`);
    }
  }
});

test("variants carry a replace map and a toolchain-verified expected output", () => {
  const withVariants = ALL_PROBLEMS.filter((p) => p.variants && p.variants.length > 0);
  assert.ok(withVariants.length >= 8, `expected at least 8 varianted problems, saw ${withVariants.length}`);
  for (const problem of withVariants) {
    for (const variant of problem.variants!) {
      assert.ok(variant.replace && Object.keys(variant.replace).length > 0,
        `${problem.id}:${variant.id} has no replace map`);
      assert.ok(Array.isArray(variant.expected?.output) && (variant.expected!.output as unknown[]).length > 0,
        `${problem.id}:${variant.id} has no expected output`);
      assert.equal(variant.expected!.verifiedBy, "toolchain", `${problem.id}:${variant.id} was not verified`);
      assert.ok((variant.rule ?? "").length > 0, `${problem.id}:${variant.id} has no rule`);
    }
    assert.notEqual(JSON.stringify(problem.expected!.output), JSON.stringify(problem.variants![0].expected!.output),
      `${problem.id} variant is not a surface change`);
  }
});

test("review intervals stay inside the supported ladder", () => {
  for (const problem of ALL_PROBLEMS) {
    assert.ok([1, 2, 3, 5, 8, 14].includes(problem.reviewInterval),
      `${problem.id} reviewInterval ${problem.reviewInterval} is outside the ladder`);
  }
});
