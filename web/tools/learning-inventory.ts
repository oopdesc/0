import { readFileSync } from "node:fs";
import { PROBLEMS } from "../src/academy/content";
import { CONCEPTS } from "../src/academy/content/concepts";
import { ALL_PROBLEMS, TOPIC_MAP, QUESTION_LABEL } from "../src/problems";
import type {
  Question,
  Manifest,
  Exam,
  Alias,
  Concept,
} from "../src/learning-v2/types";
import { groupQuestions, type CountedQuestion } from "./question-identity";

const read = (url: URL) => JSON.parse(readFileSync(url, "utf8"));
const sourceRank = { normal: 0, supplemental: 1, exam: 2, legacy: 3 };
export function buildLearningInventory() {
  const records: CountedQuestion[] = [];
  for (const language of ["java", "rust"] as const) {
    const dir = new URL(
      "../public/learning-v2/" + language + "/",
      import.meta.url,
    );
    const manifest = read(new URL("manifest.json", dir)) as Manifest;
    const aliases = read(new URL(manifest.aliasesPath, dir)) as Alias[];
    const concepts = new Map(
      (read(new URL(manifest.conceptsPath, dir)) as Concept[]).map((c) => [
        c.id,
        c.name,
      ]),
    );
    const convert = (
      q: Question,
      source: "normal" | "exam",
    ): CountedQuestion => {
      const expected = q.answer.expectedOutput.length
        ? q.answer.expectedOutput
        : q.answer.correctOptionIds
            .map((id) => q.answer.options.find((o) => o.id === id)!.text)
            .sort();
      return {
        key: q.id,
        language,
        source,
        prompt: q.prompt,
        code: q.setup.files.map((f) => f.content).join("\n"),
        answer: JSON.stringify(
          q.writingRequired ? [q.solution.files, q.tests] : expected,
        ),
        mode: q.writingRequired
          ? "code"
          : q.answer.mode === "order"
            ? "order"
            : "prediction",
        writing: q.writingRequired,
        title: q.title,
        topics: q.conceptIds.map((id) => concepts.get(id) ?? id),
        level: q.level,
        options: q.answer.options.map((o) => o.text),
        predictive: /出力|表示|コンパイル|実行.*(?:どう|結果)|何が/u.test(
          q.prompt,
        ),
        aliases: [
          ...aliases
            .filter((a) => a.targetId === q.id)
            .map((a) => a.source + ":" + a.id),
          ...q.legacyRefs.map((r) => r.source + ":" + r.id),
          ...(typeof q.extensions?.reusedFrom === "string"
            ? [q.extensions.reusedFrom]
            : []),
        ],
      };
    };
    for (const c of manifest.chunks)
      for (const q of read(new URL(c.path, dir)) as Question[])
        records.push(convert(q, "normal"));
    for (const exam of read(new URL(manifest.examsPath, dir)) as Exam[]) {
      const selected = new Set([
        ...exam.choiceQuestionIds,
        ...exam.codeQuestionIds,
      ]);
      for (const q of read(new URL(exam.questionsPath, dir)) as Question[])
        if (selected.has(q.id)) records.push(convert(q, "exam"));
    }
  }
  for (const q of PROBLEMS) {
    const a = q.answer;
    const expected =
      q.expect?.kind === "output"
        ? q.expect.output
        : a.mode === "choice"
          ? [a.options[a.correct].text]
          : a.mode === "text"
            ? a.accept
            : [];
    records.push({
      key: "academy:" + q.id,
      language: q.lang,
      source: "supplemental",
      prompt: q.prompt,
      code: q.code ?? "",
      answer: JSON.stringify(
        a.mode === "code"
          ? [a.reference, a.tests ?? [], a.lint ?? null]
          : expected,
      ),
      mode:
        a.mode === "code"
          ? "code"
          : a.mode === "order"
            ? "order"
            : "prediction",
      writing: a.mode === "code",
      aliases: [],
      options: a.mode === "choice" ? a.options.map((o) => o.text) : [],
      title: q.title,
      topics: q.concepts.map(
        (id) => CONCEPTS.find((c) => c.id === id)?.name ?? id,
      ),
      level:
        q.level <= 2 ? "beginner" : q.level === 3 ? "intermediate" : "advanced",
      predictive: [
        "predict-output",
        "will-compile",
        "runtime-exception",
      ].includes(q.kind),
    });
  }
  for (const q of ALL_PROBLEMS)
    records.push({
      key: "practice:" + q.id,
      language: q.language,
      source: "legacy",
      prompt: q.prompt,
      code: q.code ?? q.starter ?? "",
      answer: JSON.stringify(q.expected?.output ?? [q.answer]),
      mode:
        q.answerKind === "code"
          ? "code"
          : q.answerKind === "order"
            ? "order"
            : "prediction",
      writing: q.answerKind === "code",
      aliases: [],
      options: q.prediction.options ?? [],
      predictive: ["predict-output", "compile", "runtime-error"].includes(
        q.questionType,
      ),
      title:
        (TOPIC_MAP[q.topic]?.name ?? q.topic) +
        "：" +
        QUESTION_LABEL[q.questionType],
      topics: [TOPIC_MAP[q.topic]?.name ?? q.topic],
      level: (["beginner", "intermediate", "advanced"] as const)[q.level - 1],
    });
  const groups = groupQuestions(records).map((group) =>
    [...group].sort(
      (a, b) =>
        sourceRank[a.source] - sourceRank[b.source] ||
        a.key.localeCompare(b.key),
    ),
  );
  const counts = { normal: 0, supplemental: 0, exam: 0, legacy: 0 };
  for (const g of groups) counts[g[0].source]++;
  const summary = {
    method: "origin-and-content-v1",
    total: groups.length,
    java: groups.filter((g) => g[0].language === "java").length,
    rust: groups.filter((g) => g[0].language === "rust").length,
    writing: groups.filter((g) => g.some((q) => q.writing)).length,
    occurrences: records.length,
    removed: records.length - groups.length,
    normal: counts.normal,
    supplementalAdditional: counts.supplemental,
    examAdditional: counts.exam,
    legacyAdditional: counts.legacy,
    examOccurrences: records.filter((q) => q.source === "exam").length,
  };
  return { summary, groups };
}
