import assert from "node:assert/strict";
import test from "node:test";
import { emptyState } from "../src/state";
import { LESSON_IDS } from "../src/lesson-ids";
import { resources } from "../src/data";
import { exportProgress, importProgress, mergeProgress } from "../src/progress";

test("export imports valid progress without arbitrary answer fields", () => {
  const state = {
    ...emptyState(),
    completed: [LESSON_IDS[0]],
    answer: "do not export",
    token: "not a real token",
  };
  const raw = exportProgress(state);
  assert.equal(raw.includes("do not export"), false);
  assert.equal(raw.includes("token"), false);
  assert.deepEqual(importProgress(raw), {
    ...emptyState(),
    completed: [LESSON_IDS[0]],
  });
});
test("invalid, oversized and future-version imports fail without replacing current state", () => {
  for (const raw of [
    "",
    "{",
    "{}",
    " ".repeat(12001),
    '{"application":"0-learning-progress","version":2,"data":{"schema":1}}',
  ])
    assert.throws(() => importProgress(raw));
});
test("merge preserves existing marks, favorites and motion without mutating either input", () => {
  const current = {
    ...emptyState(),
    completed: [LESSON_IDS[0]],
    favorites: [resources[0].id],
    motion: "paused" as const,
  };
  const incoming = {
    ...emptyState(),
    completed: [LESSON_IDS[1]],
    favorites: [resources[1].id],
  };
  const before = JSON.stringify([current, incoming]);
  const merged = mergeProgress(current, incoming);
  assert.deepEqual(merged.completed, [LESSON_IDS[0], LESSON_IDS[1]]);
  assert.deepEqual(merged.favorites, [resources[0].id, resources[1].id]);
  assert.equal(merged.motion, "paused");
  assert.equal(JSON.stringify([current, incoming]), before);
});
test("reviews use the more recent record; old success cannot override a later failed recall", () => {
  const id = LESSON_IDS[0];
  const a = {
    ...emptyState(),
    reviews: { [id]: { last: 2000, due: 86402000, successes: 0 } },
  };
  const b = {
    ...emptyState(),
    reviews: { [id]: { last: 1000, due: 86401000, successes: 4 } },
  };
  assert.deepEqual(mergeProgress(a, b).reviews[id], a.reviews[id]);
  assert.deepEqual(mergeProgress(b, a).reviews[id], a.reviews[id]);
});
test("unknown IDs, injected properties and invalid review dates cannot become progress", () => {
  const imported = importProgress(
    '{"application":"0-learning-progress","version":1,"data":{"schema":1,"completed":["unknown"],"favorites":["unknown"],"reviews":{"__proto__":{"last":1,"due":2,"successes":1}},"__proto__":{"polluted":true}}}',
  );
  assert.deepEqual(imported, emptyState());
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
test("re-importing the same valid file is idempotent", () => {
  const state = { ...emptyState(), completed: [LESSON_IDS[0], LESSON_IDS[1]] };
  assert.deepEqual(
    mergeProgress(state, importProgress(exportProgress(state))),
    state,
  );
});
