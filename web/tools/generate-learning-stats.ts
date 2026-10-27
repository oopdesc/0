import { writeFileSync } from "node:fs";
import { PROBLEMS } from "../src/academy/content";
import { ALL_PROBLEMS } from "../src/problems";
import { LESSONS } from "../src/orbit/domain/lessons";

const stats = {
  schema: 1,
  total: PROBLEMS.length + ALL_PROBLEMS.length,
  questionBank: PROBLEMS.length,
  executionPractice: ALL_PROBLEMS.length,
  experiments: LESSONS.length,
  java:
    PROBLEMS.filter((p) => p.lang === "java").length +
    ALL_PROBLEMS.filter((p) => p.language === "java").length,
  rust:
    PROBLEMS.filter((p) => p.lang === "rust").length +
    ALL_PROBLEMS.filter((p) => p.language === "rust").length,
};
writeFileSync(
  new URL("../src/generated/learning-stats.json", import.meta.url),
  JSON.stringify(stats, null, 2) + "\n",
);
console.log(`教材件数: ${stats.total}問 + ${stats.experiments}実験`);
