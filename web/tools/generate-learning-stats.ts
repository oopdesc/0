import { readFileSync, writeFileSync } from "node:fs";
import { buildJourneyOrder } from "./journey-order";
import { LESSONS } from "../src/orbit/domain/lessons";
import { PROBLEMS } from "../src/academy/content";
import { buildLearningInventory } from "./learning-inventory";

const packs = ["java", "rust"].map((language) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../public/learning-v2/${language}/manifest.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const total = packs.reduce((n, p) => n + p.counts.normal, 0);
const writing = packs.reduce((n, p) => n + p.counts.writing, 0);
const inventory = buildLearningInventory();
const stats = {
  schema: 1,
  supplemental: PROBLEMS.length,
  supplementalJava: PROBLEMS.filter((p) => p.lang === "java").length,
  supplementalRust: PROBLEMS.filter((p) => p.lang === "rust").length,
  total,
  questionBank: total - writing,
  executionPractice: writing,
  experiments: LESSONS.length,
  exams: packs.reduce((n, p) => n + p.counts.exams, 0),
  java: packs[0].counts.normal,
  rust: packs[1].counts.normal,
  unique: inventory.summary,
};
writeFileSync(
  new URL("../src/generated/learning-stats.json", import.meta.url),
  JSON.stringify(stats, null, 2) + "\n",
);
console.log(
  `教材件数: ${stats.total}問 + ${stats.experiments}実験。再掲除外後 ${stats.unique.total}問。`,
);
writeFileSync(
  new URL("../public/learning-v2/catalog.json", import.meta.url),
  JSON.stringify({
    schema: "zero-question-catalog/2",
    total: inventory.summary.total,
    items: inventory.groups.map((group) => {
      const q = group[0];
      return [
        q.key,
        q.title ?? q.prompt.slice(0, 90),
        q.language === "java" ? 0 : 1,
        ["beginner", "intermediate", "advanced"].indexOf(q.level ?? "beginner"),
        ["normal", "supplemental", "exam", "legacy"].indexOf(q.source),
        group.find((x) => x.writing)?.key ?? null,
        [...new Set(group.flatMap((x) => x.topics ?? []))].join(" / "),
      ];
    }),
  }) + "\n",
);

writeFileSync(new URL("../public/learning-v2/journey.json",import.meta.url), JSON.stringify({schema:"zero-journey-order/1",order:buildJourneyOrder(inventory.groups)})+"\n");
