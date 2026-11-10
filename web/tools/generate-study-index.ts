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
  applications: [],
};
// Pairs where the rule carries over and the code or required action changes.
const contrastPairs = {
  java: [
    [1, 3], [2, 3], [16, 17], [17, 18], [18, 17], [21, 22], [22, 28],
    [65, 177], [65, 180], [181, 182], [182, 183], [183, 184],
    [20046, 20084], [20191, 20192], [20192, 20191], [20522, 20523], [20523, 20522],
    [20285, 42015],
  ],
  rust: [
    [30163, 30164], [30172, 30175], [30174, 30175], [30175, 40179],
    [30221, 30222], [30222, 30224], [30224, 30222],
    [30271, 30275], [30275, 30276], [30275, 40357], [30286, 30322], [30342, 30322],
    [30342, 30472], [30322, 42010], [30472, 42010],
    [30501, 30502], [30502, 30523], [30523, 40507],
    [30614, 30663], [30816, 30896], [30896, 30816],
    [30232, 30233], [30233, 30234], [30184, 30254],
    [30211, 30212], [30212, 30211],
    [30303, 30382], [30382, 40307], [30443, 30446], [30446, 30852],
    [30534, 40557],
  ],
} satisfies Record<"java" | "rust", [number, number][]>;
function checked(q: Question) {
  const run = q.evidence.compilerRun;
  if (!run) return false;
  if (["passed", "expected-compile-error", "expected-runtime-error", "ok"].includes(run.status)) return true;
  // Older items use “observed” for recorded output and store the answer as an option.
  const answer = q.answer.options.find(option => option.id === q.answer.correctOptionIds[0]);
  return run.status === "observed" && q.answer.mode === "choice" && q.answer.correctOptionIds.length === 1 &&
    run.stdout.length > 0 && answer?.text === run.stdout.join("と");
}
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
  const questions = new Map<string, Question>();
  m.chunks.forEach((chunk, unit) => {
    for (const q of read(chunk.path) as Question[]) {
      questions.set(q.id, q);
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
  const id = (n: number) => language + ":q" + String(n).padStart(4, "0");
  const pairs = new Map<string, [string, string]>();
  function add(from: string, to: string) { pairs.set(from + ">" + to, [from, to]); }
  for (const [from, to] of contrastPairs[language]) {
    const a = questions.get(id(from)), b = questions.get(id(to));
    if (!a || !b || !checked(a) || !checked(b) || (b.writingRequired && !b.tests.some(test => test.cases.length)))
      throw Error("応用問題の検査記録を確認できません: " + id(from) + " → " + id(to));
    add(a.id, b.id);
  }
  for (const source of questions.values()) {
    if (source.writingRequired || !checked(source)) continue;
    for (const id of source.transferIds) {
      const target = questions.get(id);
      if (target?.writingRequired && checked(target) && target.tests.some(test => test.cases.length) &&
          source.conceptIds.some(concept => target.conceptIds.includes(concept)))
        add(source.id, target.id);
    }
  }
  index.applications!.push(...pairs.values());
}
validateStudyIndex(index);
writeFileSync(
  new URL("../public/learning-v2/study-index.json", import.meta.url),
  JSON.stringify(encodeStudyIndex(index)) + "\n",
);
console.log(
  "学習索引: " + index.items.length + "問、応用の組み合わせ " + index.applications!.length + "組",
);
