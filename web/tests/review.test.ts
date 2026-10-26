import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, parseState, recordReview } from "../src/state.ts";
const now = 1800000000000;
test("review state survives reload without saving free-form answers", () => {
  const s = recordReview(emptyState(), "java-http", true, 1, now);
  const again = parseState(JSON.stringify(s));
  assert.deepEqual(again, s);
  assert.equal(again.reviews["java-http"].due, now + 86400000);
});
test("unknown IDs, non-finite dates and invalid counters are rejected", () => {
  const s = parseState(
    JSON.stringify({
      ...emptyState(),
      reviews: {
        unknown: { last: now, due: now + 1, successes: 1 },
        "java-http": { last: now, due: now - 1, successes: 1 },
        "java-record": { last: now, due: now + 1, successes: -1 },
      },
    }),
  );
  assert.deepEqual(s.reviews, {});
});
test("repeated recall on the same day cannot extend the interval", () => {
  const s = recordReview(emptyState(), "java-http", true, 1, now);
  assert.strictEqual(recordReview(s, "java-http", true, 30, now + 1000), s);
});
test("a failed recall restarts the count and interval", () => {
  const s = recordReview(emptyState(), "java-http", true, 7, now);
  const next = recordReview(s, "java-http", false, 1, now + 86400000);
  assert.equal(next.reviews["java-http"].successes, 0);
  assert.equal(next.reviews["java-http"].due, now + 2 * 86400000);
});
test("interval limits and old progress are preserved", () => {
  const base = {
    ...emptyState(),
    completed: ["java-http"],
    favorites: ["art"],
  };
  const s = recordReview(base, "java-http", true, 999, now);
  assert.equal(s.reviews["java-http"].due, now + 30 * 86400000);
  assert.deepEqual(s.completed, base.completed);
  assert.deepEqual(s.favorites, base.favorites);
  assert.deepEqual(base.reviews, {});
});
