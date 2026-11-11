import assert from "node:assert/strict";
import test from "node:test";
import {
  learningReturn,
  prerequisiteQuestion,
} from "../../src/learning-v2/learningNavigation";
import {
  emptyProgress,
  markExposure,
  recordKey,
  recordPrediction,
} from "../../src/learning-v2/progress";
import type { Concept } from "../../src/learning-v2/types";

test("a prerequisite detour retains only an internal bounded return destination", () => {
  const original =
    "/learn?section=drill&lang=java&q=java%3Aq0007&study=round123";
  assert.equal(learningReturn(original), original);
  assert.equal(
    learningReturn(original + "&returnTo=%2Flearn%3Fsection%3Dtoday"),
    original,
  );
  for (const invalid of [
    null,
    "https://example.com",
    "//example.com",
    "/learn/../?section=drill",
    "/learn?section=unknown",
    "/learn?section=drill&query=" + "x".repeat(1200),
    "/learn?section=drill\n",
  ])
    assert.equal(learningReturn(invalid), null);
});

test("prerequisite practice excludes the active question and the other language", () => {
  const concept: Concept = {
    id: "java:c-print",
    language: "java",
    name: "表示",
    summary: "",
    minimalExample: "",
    hardPrerequisiteIds: [],
    relatedIds: [],
    introducedBy: ["java:q0001", "rust:q20001"],
    problemIds: ["java:q0002"],
  };
  assert.equal(
    prerequisiteQuestion(concept, "java:q0001", "java"),
    "java:q0002",
  );
  assert.equal(
    prerequisiteQuestion({ ...concept, problemIds: [] }, "java:q0001", "java"),
    undefined,
  );
});

test("opening a prerequisite example prevents the current answer becoming blind-correct", () => {
  const key = recordKey("java:q0007", "1", "prediction");
  const now = Date.now() - 1000;
  const exposed = markExposure(emptyProgress(), key, "hint", now);
  const answered = recordPrediction(exposed, key, true, now + 1);
  assert.equal(answered.records[key].blindCorrect, 0);
  assert.equal(answered.records[key].assistedCorrect, 1);
});
