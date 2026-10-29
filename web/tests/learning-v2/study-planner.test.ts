import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  itemKey,
  planStudy,
  studySummary,
  validateStudyIndex,
} from "../../src/learning-v2/studyPlanner";
import type {
  StudyIndex,
  StudyItem,
  StudyFilter,
} from "../../src/learning-v2/studyPlanner";
import {
  emptyProgress,
  recordPrediction,
  recordCodeCheck,
  saveDraft,
} from "../../src/learning-v2/progress";
const now = Date.now(),
  DAY = 86400000;
const question = (id: string, extra: Partial<StudyItem> = {}): StudyItem => ({
  id,
  language: id.startsWith("java:") ? "java" : "rust",
  title: id,
  version: "v1",
  level: "beginner",
  writing: false,
  unit: 0,
  order: Number(id.split("q")[1]),
  concepts: [],
  prerequisites: [],
  ...extra,
});
const items = [
  question("java:q0001"),
  question("rust:q0001"),
  question("java:q0002", { writing: true }),
  question("rust:q0002", {
    level: "advanced",
    prerequisites: ["rust:c-borrow"],
  }),
];
const index: StudyIndex = {
  schema: "zero-study-index/1",
  items,
  concepts: { "rust:c-borrow": { language: "rust", name: "借用" } },
};
const filter: StudyFilter = {
  language: "all",
  level: "all",
  kind: "all",
  limit: 10,
  includeNew: true,
};
test("the daily plan prioritizes due work, retries and drafts before new problems", () => {
  let state = recordPrediction(
    emptyProgress(),
    itemKey(items[0]),
    true,
    now - 2 * DAY,
  );
  state = recordPrediction(state, itemKey(items[1]), false, now - 1000);
  state = saveDraft(state, itemKey(items[2]), "my draft", now);
  const plan = planStudy(index, state, filter, now);
  assert.deepEqual(
    plan.map((p) => p.reason),
    ["due", "retry", "draft", "new"],
  );
  assert.equal(plan[3].item.id, "rust:q0002");
  assert.deepEqual(plan[3].prerequisiteNames, ["借用"]);
  const only = planStudy(
    index,
    state,
    { ...filter, language: "rust", level: "advanced", kind: "prediction" },
    now,
  );
  assert.equal(only.length, 1, "prerequisites are advice, never a lock");
  assert.deepEqual(
    planStudy(index, emptyProgress(), { ...filter, includeNew: false }, now),
    [],
  );
});
test("old versions are retained and never turn a current question into completed work", () => {
  const old = recordPrediction(
    emptyProgress(),
    "java:q0001@old#prediction",
    true,
    now - 2 * DAY,
  );
  assert.equal(studySummary(index, old, now).seen, 0);
  assert.equal(studySummary(index, old, now).retained, 1);
  assert.equal(planStudy(index, old, filter, now)[0].reason, "new");
});
test("filters and language interleaving keep a bounded, deterministic plan", () => {
  assert.deepEqual(
    planStudy(index, emptyProgress(), filter, now)
      .slice(0, 2)
      .map((p) => p.item.language),
    ["java", "rust"],
  );
  const only = planStudy(
    index,
    emptyProgress(),
    { ...filter, kind: "code", limit: 1 },
    now,
  );
  assert.equal(only.length, 1);
  assert.equal(only[0].item.id, "java:q0002");
  const passed = recordCodeCheck(
    emptyProgress(),
    itemKey(items[2]),
    "passed",
    now,
  );
  assert.equal(studySummary(index, passed, now).codePassed, 1);
  assert.equal(studySummary(index, passed, now).independent, 0);
  assert.equal(
    planStudy(
      index,
      passed,
      { ...filter, kind: "code", includeNew: false },
      now,
    ).length,
    0,
  );
});
test("the index rejects duplicate IDs, cross-language links, scripts and oversized metadata", () => {
  assert.equal(validateStudyIndex(index), index);
  const duplicate = structuredClone(index);
  duplicate.items.push({ ...items[0] });
  assert.throws(() => validateStudyIndex(duplicate));
  const cross = structuredClone(index);
  cross.items[0].prerequisites = ["rust:c-borrow"];
  assert.throws(() => validateStudyIndex(cross));
  const bad = structuredClone(index);
  bad.items[0].id = "javascript:alert(1)";
  assert.throws(() => validateStudyIndex(bad));
  const long = structuredClone(index);
  long.items[0].title = "x".repeat(251);
  assert.throws(() => validateStudyIndex(long));
});
test("the generated public study index covers every real question and contains no answers", () => {
  const actual = validateStudyIndex(
    JSON.parse(
      readFileSync(
        new URL("../../public/learning-v2/study-index.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const expected: string[] = [];
  for (const lang of ["java", "rust"]) {
    const dir = new URL(
      "../../public/learning-v2/" + lang + "/",
      import.meta.url,
    );
    const m = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
    for (const c of m.chunks) {
      for (const q of JSON.parse(readFileSync(new URL(c.path, dir), "utf8")))
        expected.push(q.id);
    }
  }
  assert.deepEqual(actual.items.map((q) => q.id).sort(), expected.sort());
  for (const q of actual.items) {
    assert.equal((q as unknown as Record<string, unknown>).solution, undefined);
    assert.equal((q as unknown as Record<string, unknown>).answer, undefined);
  }
});

import { encodeStudyIndex } from "../../src/learning-v2/studyPlanner";
test("compact public metadata roundtrips exactly and rejects bad dictionary references", () => {
  const packed = encodeStudyIndex(index);
  assert.deepEqual(
    validateStudyIndex(JSON.parse(JSON.stringify(packed))),
    index,
  );
  const bad = structuredClone(packed);
  bad.items[0][2] = -1;
  assert.throws(() => validateStudyIndex(bad));
  const cross = structuredClone(packed);
  cross.items[0][8] = [0];
  assert.throws(() => validateStudyIndex(cross));
  const duplicate = structuredClone(packed);
  duplicate.concepts.push(duplicate.concepts[0]);
  assert.throws(() => validateStudyIndex(duplicate));
});
