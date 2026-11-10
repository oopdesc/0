import assert from "node:assert/strict";
import test from "node:test";
import { EXAM_STORAGE_KEY } from "../../src/learning-v2/examState";
import { JOURNEY_KEY, emptyJourney } from "../../src/learning-v2/journey-state";
import { exportLearningBackup, restoreLearningBackup } from "../../src/learning-v2/learningBackup";
import { emptyProgress, exportProgress, recordKey, saveDraft, STORAGE_KEY } from "../../src/learning-v2/progress";

function memory(values: Map<string, string>, failKey?: string) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failKey) throw Error("quota");
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("a combined backup preserves typed work and rolls back if a later write fails", () => {
  const key = recordKey("java:q0001", "1.0.0", "prediction");
  const practice = saveDraft(emptyProgress(), key, "  3\n", Date.now());
  const raw = exportLearningBackup(memory(new Map([[STORAGE_KEY, exportProgress(practice)]])));
  const original = JSON.stringify(emptyJourney());
  const values = new Map([[JOURNEY_KEY, original]]);

  assert.throws(() => restoreLearningBackup(memory(values, EXAM_STORAGE_KEY), raw), /変更を取り消しました/);
  assert.deepEqual([...values], [[JOURNEY_KEY, original]]);
  assert.throws(() => restoreLearningBackup(memory(values), "{bad json"));
  assert.deepEqual([...values], [[JOURNEY_KEY, original]]);

  const result = restoreLearningBackup(memory(values), raw);
  assert.equal(result.counts.drafts, 1);
  assert.equal(JSON.parse(values.get(STORAGE_KEY)!).drafts[key].content, "  3\n");
});
