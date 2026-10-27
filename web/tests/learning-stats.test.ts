import test from "node:test";
import assert from "node:assert/strict";
import stats from "../src/generated/learning-stats.json";
import { PROBLEMS } from "../src/academy/content";
import { ALL_PROBLEMS } from "../src/problems";
import { LESSONS } from "../src/orbit/domain/lessons";
import { ART_EXHIBITS, readExhibit } from "../src/art/exhibits";

test("public counts match the published problems, without counting experiments as questions", () => {
  assert.equal(stats.questionBank, PROBLEMS.length);
  assert.equal(stats.executionPractice, ALL_PROBLEMS.length);
  assert.equal(stats.total, PROBLEMS.length + ALL_PROBLEMS.length);
  assert.equal(stats.java + stats.rust, stats.total);
  assert.equal(stats.experiments, LESSONS.length);
});
test("art links survive reloads and preserve older galaxy view links", () => {
  for (const [id] of ART_EXHIBITS) assert.equal(readExhibit("?exhibit="+id), id);
  assert.equal(readExhibit("?exhibit=observation"), "observation");
  assert.equal(readExhibit("?scene=black-hole"), "galaxy");
  assert.equal(readExhibit("?view=photo&scene=m51"), "observation");
  assert.equal(readExhibit("?model=galaxy"), "galaxy");
  assert.equal(readExhibit("?exhibit=../../private"), "solar");
  assert.equal(readExhibit(""), "solar");
});
