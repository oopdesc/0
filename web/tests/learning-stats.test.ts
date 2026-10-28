import test from "node:test";
import assert from "node:assert/strict";
import stats from "../src/generated/learning-stats.json";
import { readFileSync } from "node:fs";
import { LESSONS } from "../src/orbit/domain/lessons";
import { ART_EXHIBITS, readExhibit } from "../src/art/exhibits";

test("public counts match the published problems, without counting experiments as questions", () => {
  const packs=['java','rust'].map(language=>JSON.parse(readFileSync(new URL(`../public/learning-v2/${language}/manifest.json`,import.meta.url),'utf8')));
  const all=packs.flatMap((m,i)=>m.chunks.flatMap((c:{path:string})=>JSON.parse(readFileSync(new URL(`../public/learning-v2/${i===0?'java':'rust'}/${c.path}`,import.meta.url),'utf8'))));
  assert.equal(new Set(all.map(q=>q.id)).size,all.length);
  assert.equal(stats.questionBank, all.filter(q=>!q.writingRequired).length);
  assert.equal(stats.executionPractice, all.filter(q=>q.writingRequired).length);
  assert.equal(stats.total, all.length);
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
