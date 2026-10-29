import { readFileSync, writeFileSync } from "node:fs";
import {
  encodeStudyIndex,
  validateStudyIndex,
} from "../src/learning-v2/studyPlanner";
import type { StudyIndex } from "../src/learning-v2/studyPlanner";
import type { Question, Concept, Manifest } from "../src/learning-v2/types";
const index: StudyIndex = {
  schema: "zero-study-index/1",
  items: [],
  concepts: {},
};
for (const language of ["java", "rust"] as const) {
  const dir = new URL(
      "../public/learning-v2/" + language + "/",
      import.meta.url,
    ),
    read = (p: string) => JSON.parse(readFileSync(new URL(p, dir), "utf8"));
  const m = read("manifest.json") as Manifest;
  const namespaced = (id: string) =>
    id.startsWith(language + ":") ? id : language + ":" + id;
  for (const c of read(m.conceptsPath) as Concept[])
    index.concepts[namespaced(c.id)] = { name: c.name, language };
  let count = 0;
  m.chunks.forEach((chunk, unit) => {
    for (const q of read(chunk.path) as Question[]) {
      index.items.push({
        id: q.id,
        language,
        title: q.title,
        version: q.contentVersion,
        level: q.level,
        writing: q.writingRequired,
        unit,
        order: q.order,
        concepts: q.conceptIds.map(namespaced),
        prerequisites: q.prerequisiteConceptIds.map(namespaced),
      });
      count++;
    }
  });
  if (count !== m.counts.normal)
    throw Error(language + ": 索引と収録件数が一致しません。");
}
validateStudyIndex(index);
writeFileSync(
  new URL("../public/learning-v2/study-index.json", import.meta.url),
  JSON.stringify(encodeStudyIndex(index)) + "\n",
);
console.log(
  "学習索引: " + index.items.length + "問（解答・下書きは含めません）",
);
