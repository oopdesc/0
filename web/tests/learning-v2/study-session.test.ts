import test from "node:test";
import assert from "node:assert/strict";
import { completedStudy } from "../../src/learning-v2/studySession";
import { parseStudyRound, type StudyRound } from "../../src/learning-v2/studyRound";
import type { StudyItem } from "../../src/learning-v2/studyPlanner";

const items: StudyItem[] = Array.from({ length: 9 }, (_, i) => ({
  id: "java:q000" + i, version: "1", title: "問題 " + i, language: "java", writing: i === 5,
  level: "beginner", unit: 1, order: i, concepts: [], prerequisites: [],
}));
const round: StudyRound = {
  token: "session-1234", startedAt: Date.now(), ids: items.map(({ id }) => id),
  filter: { language: "java", level: "all", kind: "all", limit: 10, includeNew: true },
  outcomes: ["attempted", "skipped", "attempted", "attempted", "attempted", "attempted", "attempted", "skipped", "attempted"],
  results: ["correct", null, "tentative", "assisted", "wrong", "code-failed", "self-check", null, null],
};

test("a completed set records evidence separately and creates up to five targeted retries", () => {
  const result = completedStudy(round, items)!;
  const counts = new Map(result.counts);
  assert.equal(counts.get("自力で正答"), 1);
  assert.equal(counts.get("手元で自己確認"), 1);
  assert.equal(counts.get("飛ばした"), 2);
  assert.equal(counts.get("結果の記録なし"), 1);
  assert.deepEqual(result.followUpIds, [4, 5, 2, 3, 1].map(i => items[i].id));
  assert.equal(completedStudy(round, items.filter((_, i) => i !== 4))?.followUpIds.includes(items[4].id), false);
});

test("an active set has no final report, and a retry does not suggest another immediate retry", () => {
  assert.equal(completedStudy({ ...round, outcomes: round.outcomes.slice(0, 1) }, items), null);
  const followUp: StudyRound = { ...round, purpose: "follow-up" };
  assert.deepEqual(parseStudyRound(JSON.stringify(followUp)), followUp);
  assert.deepEqual(completedStudy(followUp, items)?.followUpIds, []);
});

test("older sets without evidence snapshots do not infer old results from later attempts", () => {
  const result = completedStudy({ ...round, results: undefined }, items)!;
  assert.equal(new Map(result.counts).get("結果の記録なし"), 7);
  assert.deepEqual(result.followUpIds, [items[1].id, items[7].id]);
});
