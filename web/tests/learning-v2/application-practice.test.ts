import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applicationHistory, planApplications } from "../../src/learning-v2/applicationPractice";
import { emptyProgress, exportProgress, importProgress, markExposure, mergeProgress, recordApplication, recordPrediction, saveDraft } from "../../src/learning-v2/progress";
import { delayedReviewSummary, itemKey, validateStudyIndex } from "../../src/learning-v2/studyPlanner";
import { parseStudyRound } from "../../src/learning-v2/studyRound";
import { predictionContent, predictionInput, recallOutput } from "../../src/learning-v2/predictionDraft";
import type { Manifest, Question } from "../../src/learning-v2/types";

const index = validateStudyIndex(JSON.parse(readFileSync(new URL("../../public/learning-v2/study-index.json", import.meta.url), "utf8")));
const keys = new Map(index.items.map(item => [item.id, itemKey(item)]));
const day = 86_400_000;
const now = Date.now();
const source = keys.get("java:q0001")!;
const target = keys.get("java:q0003")!;

test("delayed application waits for an independent response, then uses unseen matched problems", () => {
  const initial = recordPrediction(emptyProgress(), source, true, now - 2 * day);
  const legacy = structuredClone(initial);
  delete legacy.records[source].firstCorrectAt;
  assert.equal(planApplications(index, legacy, "java", "prediction", now).ready[0]?.item.id, "java:q0003");
  const waiting = recordPrediction(emptyProgress(), source, true, now - 100);
  assert.equal(planApplications(index, waiting, "java", "prediction", now).ready.length, 0);
  assert.equal(planApplications(index, waiting, "java", "prediction", now).next, now - 100 + day);
  const rested = recordPrediction(initial, source, true, now);
  assert.equal(planApplications(index, rested, "java", "prediction", now).ready[0]?.item.id, "java:q0003");
  for (const seen of [markExposure(rested, target, "hint", now), recordPrediction(rested, target, false, now), saveDraft(rested, target, '["a"]', now)])
    assert.ok(!planApplications(index, seen, "java", "prediction", now).ready.some(row => row.item.id === "java:q0003"));
  const rust = recordPrediction(emptyProgress(), keys.get("rust:q30175")!, true, now - day);
  assert.equal(planApplications(index, rust, "rust", "code", now).ready[0]?.item.id, "rust:q40179");
});

test("tentative answers shorten review and delayed evidence survives a same-day retry and backup", () => {
  const previous = recordPrediction(emptyProgress(), source, true, now - 2 * day);
  const tentative = recordPrediction(previous, source, true, now - 1000, false, true);
  assert.equal(tentative.records[source].blindCorrect, 1);
  assert.equal(tentative.records[source].lastOutcome, "tentative");
  assert.equal(tentative.records[source].dueAt, now - 1000 + day);
  assert.equal(planApplications(index, tentative, "java", "prediction", now).ready.length, 0);
  const retried = recordPrediction(tentative, source, true, now);
  assert.equal(retried.records[source].lastOutcome, "assisted");
  assert.equal(retried.records[source].delayed?.outcome, "tentative");
  assert.equal(retried.records[source].firstCorrectAt, now - 2 * day);
  const consulted = recordPrediction(markExposure(previous, source, "solution", now - 1000), source, false, now);
  assert.equal(consulted.records[source].delayed, undefined);
  const latest = structuredClone(retried);
  delete latest.records[source].delayed;
  delete latest.records[source].firstCorrectAt;
  const merged = mergeProgress(latest, tentative);
  const imported = importProgress(exportProgress(merged), emptyProgress());
  assert.ok(imported.ok);
  assert.deepEqual(delayedReviewSummary(index, imported.state).java, { correct: 0, tentative: 1, wrong: 0 });
});

test("old study sets still load and new sets preserve outcomes without grading skipped steps", () => {
  const round = { token: "review-123", startedAt: now, ids: ["java:q0003"], outcomes: ["attempted"],
    filter: { language: "java", level: "all", kind: "prediction", limit: 5, includeNew: false } };
  assert.deepEqual(parseStudyRound(JSON.stringify(round)), round);
  const updated = { ...round, purpose: "application", results: ["tentative"] };
  assert.deepEqual(parseStudyRound(JSON.stringify(updated)), updated);
  assert.throws(() => parseStudyRound(JSON.stringify({ ...updated, outcomes: ["skipped"] })));
  assert.throws(() => parseStudyRound(JSON.stringify({ ...updated, results: [["tentative"]] })));
});

test("free input is offered only when recorded stdout agrees with the original answer", () => {
  const dir = new URL("../../public/learning-v2/java/", import.meta.url);
  const read = (file: string) => JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const manifest: Manifest = read("manifest.json");
  const item = (read(manifest.chunks.find(chunk => chunk.ids.includes("java:q0003"))!.path) as Question[])
    .find(q => q.id === "java:q0003")!;
  assert.deepEqual(recallOutput(item), ["AB"]);
  const draft = { ...predictionInput(item), typed: true, text: " AB\n" };
  assert.deepEqual(predictionInput(item, predictionContent(item, draft)), draft);
  const mismatch = structuredClone(item);
  mismatch.evidence.compilerRun!.stdout = ["other"];
  assert.equal(recallOutput(mismatch), null);
  assert.equal(predictionInput(mismatch, predictionContent(item, draft)).typed, false);
});

test("application history keeps the first result when ordinary practice or a retry updates the question", () => {
  const first = recordApplication(recordPrediction(emptyProgress(), target, false, now - 1000), target, now - 1500);
  const retry = recordApplication(recordPrediction(first, target, true, now), target, now - 1500);
  const imported = importProgress(exportProgress(first), retry);
  assert.ok(imported.ok);
  assert.equal(imported.state.records[target].lastOutcome, "assisted");
  assert.deepEqual([...applicationHistory(index, imported.state)], [["wrong", 1]]);
});
