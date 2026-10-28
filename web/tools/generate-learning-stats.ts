import { readFileSync, writeFileSync } from "node:fs";
import { LESSONS } from "../src/orbit/domain/lessons";
import { PROBLEMS } from "../src/academy/content";

const packs = ['java', 'rust'].map(language => JSON.parse(readFileSync(new URL(`../public/learning-v2/${language}/manifest.json`, import.meta.url), 'utf8')));
const total = packs.reduce((n,p) => n + p.counts.normal, 0);
const writing = packs.reduce((n,p) => n + p.counts.writing, 0);
const stats = {
  schema: 1,
  supplemental: PROBLEMS.length,
  supplementalJava: PROBLEMS.filter(p => p.lang === "java").length,
  supplementalRust: PROBLEMS.filter(p => p.lang === "rust").length,
  total,
  questionBank: total - writing,
  executionPractice: writing,
  experiments: LESSONS.length,
  exams: packs.reduce((n,p) => n + p.counts.exams, 0),
  java: packs[0].counts.normal,
  rust: packs[1].counts.normal,
};
writeFileSync(
  new URL("../src/generated/learning-stats.json", import.meta.url),
  JSON.stringify(stats, null, 2) + "\n",
);
console.log(`教材件数: ${stats.total}問 + ${stats.experiments}実験`);
