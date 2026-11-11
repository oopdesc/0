import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { makeHttpSuiteArchive } from "../../src/learning-v2/httpSuiteArchive";
import {
  emptyPractice,
  evaluateSuite,
  modelLookup,
  parsePractice,
  practiceReport,
  replayConcurrency,
  type ContractCase,
  type RaceAction,
} from "../../src/learning-v2/practiceLab";
import {
  validateWorkflow,
  workflowFiles,
  workflowKey,
  workflowStatus,
} from "../../src/learning-v2/workflow";

test("contract model separates strict ASCII/range validation, absence and repository failure", () => {
  for (const raw of [
    "",
    "0",
    "-1",
    "+1",
    "1abc",
    "１",
    "1.0",
    "1e0",
    "2147483648",
  ])
    assert.equal(modelLookup(raw, "ready").status, 400, raw);
  for (const raw of ["1", "001", "0000001"])
    assert.equal(modelLookup(raw, "ready").body.title, "Java", raw);
  assert.equal(modelLookup("2147483647", "ready").status, 404);
  assert.equal(modelLookup("abc", "down").status, 400);
  assert.equal(modelLookup("abc", "down").repositoryCalled, false);
  assert.equal(modelLookup("1", "down").status, 500);
  assert.equal(modelLookup("1", "down").repositoryCalled, true);
  assert.doesNotMatch(
    JSON.stringify(modelLookup("1", "down")),
    /SQLITE|private/,
  );
});

const suite: ContractCase[] = [
  {
    name: "正常",
    successShape: true,
    id: "1",
    repository: "ready",
    status: 200,
    title: "Java",
    safeError: false,
  },
  {
    name: "混在",
    id: "1abc",
    repository: "ready",
    status: 400,
    title: "",
    safeError: true,
  },
  {
    name: "範囲",
    id: "2147483648",
    repository: "ready",
    status: 400,
    title: "",
    safeError: true,
  },
  {
    name: "未登録",
    id: "3",
    repository: "ready",
    status: 404,
    title: "",
    safeError: true,
  },
  {
    name: "DB障害",
    id: "1",
    repository: "down",
    status: 500,
    title: "",
    safeError: true,
  },
  {
    name: "検証の順序",
    id: "abc",
    repository: "down",
    status: 400,
    title: "",
    safeError: true,
  },
];
test("designed tests detect six independent faults only when reference expectations are valid", () => {
  const result = evaluateSuite(suite);
  assert.equal(result.valid, true);
  assert.ok(result.mutations.every((m) => m.caughtBy.length));
  assert.deepEqual(
    result.mutations.find((m) => m.id === "order")?.caughtBy,
    [5],
  );
  const invalid = evaluateSuite([{ ...suite[0], status: 404 }]);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.mutations.every((m) => !m.caughtBy.length));
  const statusOnly = evaluateSuite(
    suite.map((t) => ({ ...t, safeError: false })),
  );
  assert.equal(
    statusOnly.mutations.find((m) => m.id === "leak")?.caughtBy.length,
    0,
  );
  assert.equal(evaluateSuite([]).valid, false);
});

const actions: RaceAction[] = [
  { client: "A", operation: "read", title: "Aのタイトル" },
  { client: "B", operation: "read", title: "Bのタイトル" },
  { client: "A", operation: "save", title: "Aのタイトル" },
  { client: "B", operation: "save", title: "Bのタイトル" },
];
test("same operation order exposes a lost update and atomic version check prevents overwrite", () => {
  const before = JSON.stringify(actions);
  const unguarded = replayConcurrency(actions, false),
    guarded = replayConcurrency(actions, true);
  assert.deepEqual(unguarded.book, { title: "Bのタイトル", version: 3 });
  assert.deepEqual(guarded.book, { title: "Aのタイトル", version: 2 });
  assert.equal(guarded.events[3].status, 409);
  assert.equal(guarded.snapshots.A?.version, 2);
  assert.equal(guarded.snapshots.B?.version, 1);
  const reread = replayConcurrency(
    [
      ...actions,
      { client: "B", operation: "read", title: "B調整" },
      { client: "B", operation: "save", title: "A+B調整" },
    ],
    true,
  );
  assert.equal(reread.events.at(-1)?.status, 200);
  assert.deepEqual(reread.book, { title: "A+B調整", version: 3 });
  assert.equal(replayConcurrency([actions[2]], true).events[0].status, null);
  assert.equal(JSON.stringify(actions), before);
});

test("practical drafts roundtrip in existing backup format and reject malformed or oversized input", () => {
  const draft = {
    ...emptyPractice(),
    cases: suite,
    notes: "再現→原因→修正→回帰",
    actions,
    guarded: true,
  };
  assert.deepEqual(parsePractice(JSON.stringify(draft)), draft);
  for (const value of [
    { ...draft, schema: "unknown" },
    { ...draft, notes: "x".repeat(8001) },
    { ...draft, cases: [] },
    { ...draft, cases: [{ ...suite[0], status: 201 }] },
    { ...draft, actions: Array(21).fill(actions[0]) },
    { ...draft, actions: [{ client: "X", operation: "read", title: "x" }] },
  ])
    assert.throws(() => parsePractice(JSON.stringify(value)));
  assert.throws(() => parsePractice("{"));
  assert.throws(() => parsePractice(" ".repeat(48001)));
  const report = practiceReport(draft);
  assert.match(report, /実HTTP・DB・Java\/Rustコードは未実行/);
  assert.match(report, /更新競合/);
  assert.match(report, /再現→原因→修正→回帰/);
});

test("workflow bundle includes every stage, distinguishes untouched templates, and refuses corrupt saved drafts", () => {
  const course = validateWorkflow(
    JSON.parse(
      readFileSync(
        new URL("../../public/learning-v2/workflow.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const files = workflowFiles(course, {});
  assert.equal(Object.keys(files).length, 9);
  assert.match(files["README.md"], /テンプレート（未編集）/);
  assert.match(files["README.md"], /リリース承認の証明ではありません/);
  const changed = workflowFiles(course, {
    [workflowKey(0)]: {
      content: JSON.stringify({
        schema: "zero-workflow-draft/1",
        text: "私の要件",
        checked: [true, false, false],
      }),
    },
  });
  assert.equal(changed[course.stages[0].file], "私の要件");
  assert.match(changed["README.md"], /自己レビュー 1\/3/);
  assert.throws(() =>
    workflowFiles(course, { [workflowKey(0)]: { content: "broken" } }),
  );
});

test("user-designed HTTP suite exports data separately from executable code and includes its exact local verifier", () => {
  const runner = readFileSync(
    new URL("../../practical/check_contract.py", import.meta.url),
    "utf8",
  );
  const files = unzipSync(makeHttpSuiteArchive(suite, runner));
  assert.equal(strFromU8(files["check_contract.py"]), runner);
  assert.deepEqual(
    JSON.parse(strFromU8(files["contract-suite.json"])).cases,
    suite,
  );
  assert.ok(
    strFromU8(files["README.md"]).includes(
      "スキップした項目は合格ではありません",
    ),
  );
  assert.ok(
    strFromU8(files["COPYRIGHT.txt"]).includes("商用転用には事前の許諾"),
  );
  assert.throws(() => makeHttpSuiteArchive([], runner));
  assert.throws(() => makeHttpSuiteArchive(suite, ""));
});

test("workflow status never equates a blank or untouched template with a written, reviewed artifact; saved keys cannot be remapped", () => {
  const course = validateWorkflow(
    JSON.parse(
      readFileSync(
        new URL("../../public/learning-v2/workflow.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const draft = (text: string) => ({
    content: JSON.stringify({
      schema: "zero-workflow-draft/1",
      text,
      checked: [true, true, true],
    }),
  });
  const untouched = workflowStatus(course, {
    [workflowKey(0)]: draft(course.stages[0].template),
  });
  assert.equal(untouched[0].written, false);
  assert.equal(untouched[0].reviewed, false);
  const blank = workflowStatus(course, { [workflowKey(0)]: draft("  \n") });
  assert.equal(blank[0].reviewed, false);
  const edited = workflowStatus(course, {
    [workflowKey(0)]: draft("REQ-1: 利用者は本を検索できる。"),
  });
  assert.equal(edited[0].reviewed, true);
  assert.equal(edited[1].checks, 0);
  assert.match(
    workflowFiles(course, { [workflowKey(0)]: draft("") })["README.md"],
    /未記入/,
  );
  assert.throws(() =>
    validateWorkflow({
      ...course,
      stages: [course.stages[1], course.stages[0], ...course.stages.slice(2)],
    }),
  );
});

test("JPA download contains exactly the reviewed source and tests, with no dependencies, hidden paths or duplicate entries", async () => {
  const { makeJpaArchive } = await import("../../src/learning-v2/jpaArchive");
  const bundle = JSON.parse(
    readFileSync(
      new URL("../../public/learning-v2/jpa-workshop.json", import.meta.url),
      "utf8",
    ),
  );
  const files = unzipSync(makeJpaArchive(bundle));
  assert.equal(Object.keys(files).length, 8);
  for (const entry of bundle.files) {
    assert.equal(strFromU8(files[entry.path]), entry.content);
    assert.equal(
      entry.content,
      readFileSync(
        new URL("../../practical/jpa/" + entry.path, import.meta.url),
        "utf8",
      ),
    );
  }
  assert.ok(
    Object.keys(files).every(
      (p) => !p.includes("target/") && !p.endsWith(".jar"),
    ),
  );
  assert.match(strFromU8(files["COPYRIGHT.txt"]), /商用転用には事前の許諾/);
  for (const path of ["../secret", ".env", "target/classes/Book.class"])
    assert.throws(() =>
      makeJpaArchive({
        ...bundle,
        files: [{ ...bundle.files[0], path }, ...bundle.files.slice(1)],
      }),
    );
  assert.throws(() =>
    makeJpaArchive({
      ...bundle,
      files: [bundle.files[0], bundle.files[0], ...bundle.files.slice(2)],
    }),
  );
});
