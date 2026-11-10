import test from "node:test";
import assert from "node:assert/strict";
import { planDiagnosticPractice } from "../../src/learning-v2/diagnosticPractice";
import { emptyProgress, recordPrediction } from "../../src/learning-v2/progress";
import { itemKey, type StudyIndex, type StudyItem } from "../../src/learning-v2/studyPlanner";

function item(id: string, concepts: string[], changes: Partial<StudyItem> = {}): StudyItem {
  return {
    id, concepts, language: "java", level: "beginner", title: id,
    version: "1.0.0", unit: 1, order: Number(id.split(":q")[1]), writing: false, prerequisites: [], ...changes,
  };
}

test("diagnostic practice uses fresh related questions and takes mistakes before guesses", () => {
  const concepts = { "java:loop": { name: "ループ", language: "java" as const } };
  const loop = ["java:loop"];
  const q1 = item("java:q0001", loop), q2 = item("java:q0002", loop);
  const seen = item("java:q0003", loop), fresh = item("java:q0004", loop);
  const targets = [q1, q2].map(q => ({ ...q, conceptIds: q.concepts, prerequisiteConceptIds: [] }));
  const index: StudyIndex = {
    schema: "zero-study-index/1", concepts,
    items: [q1, q2, seen, fresh,
      item("java:q0005", loop, { writing: true }), item("java:q0006", loop, { level: "advanced" }),
      item("rust:q0001", loop, { language: "rust" })],
  };
  const results = { [q1.id]: { correct: true, uncertain: true }, [q2.id]: { correct: false, uncertain: false } };
  const progress = recordPrediction(emptyProgress(), itemKey(seen), true);
  assert.deepEqual(planDiagnosticPractice(targets, results, index, progress).map(p => [p.sourceId, p.item.id, p.relation, p.concept]), [
    [q2.id, fresh.id, "same", "ループ"], [q1.id, seen.id, "same", "ループ"],
  ]);
  assert.deepEqual(planDiagnosticPractice(targets, { [q1.id]: { correct: true, uncertain: false } }, index, progress), []);
});

test("prerequisite and original are explicit fallbacks; a set has at most five distinct items", () => {
  const items = Array.from({ length: 6 }, (_, i) => item("java:q000" + (i + 1), ["java:c" + (i + 1)]));
  const extra = item("java:q0010", ["java:base"]);
  const questions = items.map(q => ({ ...q, conceptIds: q.concepts, prerequisiteConceptIds: extra.concepts }));
  const results = Object.fromEntries(items.map(q => [q.id, { correct: false, uncertain: false }]));
  const plan = planDiagnosticPractice(questions, results, {
    schema: "zero-study-index/1", concepts: {}, items: [...items, extra],
  }, emptyProgress());
  assert.deepEqual(plan.map(p => [p.item.id, p.relation]), [
    [extra.id, "prerequisite"], ...items.slice(1, 5).map(q => [q.id, "original"]),
  ]);
});
