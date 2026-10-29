import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import {
  canArchiveExercise,
  exerciseFiles,
  buildExerciseArchive,
} from "../../src/learning-v2/exerciseArchive";
import type { Question } from "../../src/learning-v2/types";
const read = (language: string) =>
  JSON.parse(
    readFileSync(
      new URL(
        "../../public/learning-v2/" + language + "/backend-writing.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Question[];
test("offline exercise exports retain the exact draft and fixed tests, with a separate reference", () => {
  for (const language of ["java", "rust"])
    for (const q of read(language)) {
      const before = JSON.stringify(q),
        draft = q.solution.files[0].content + "\n// 日本語の下書き";
      assert(canArchiveExercise(q));
      const files = exerciseFiles(q, draft);
      assert.equal(files[q.setup.files[0].path], draft);
      assert.equal(
        files[q.tests[0].testFiles[0].path],
        q.tests[0].testFiles[0].content,
      );
      assert.equal(
        files["reference/" + q.solution.files[0].path],
        q.solution.files[0].content,
      );
      assert.deepEqual(
        JSON.parse(files["exercise.json"]).cases,
        q.tests[0].cases.map((c) => ({
          id: c.id,
          stdin: c.stdin,
          expectedStdout: c.expectedStdout,
        })),
      );
      assert.match(files["README.txt"], /node run-tests\.mjs/);
      assert(!files["run-tests.mjs"].includes("https://"));
      assert(
        Object.keys(files).every(
          (f) => !f.startsWith("/") && !f.split("/").includes(".."),
        ),
      );
      assert.equal(JSON.stringify(q), before);
    }
});
test("exercise ZIPs preserve UTF-8 and all entries stay inside their own folder", async () => {
  const q = read("java")[0],
    zip = await buildExerciseArchive(
      q,
      "// 本📚\n" + q.solution.files[0].content,
    ),
    files = unzipSync(zip),
    prefix = "0-java-q43001/";
  assert(Object.keys(files).every((p) => p.startsWith(prefix)));
  assert.match(strFromU8(files[prefix + "Main.java"]), /本📚/);
  assert(files[prefix + ".project"]);
  assert.match(
    strFromU8(files[prefix + ".classpath"]),
    /excluding="reference\/\*\*"/,
  );
});
test("unsupported or unsafe contracts cannot masquerade as runnable exercise archives", () => {
  const q = read("java")[0];
  for (const change of [
    { runnerProfile: null },
    { id: "java:../../secret" },
    { id: "rust:q43001" },
    { setup: { ...q.setup, dependencies: ["external.jar"] } },
    { tests: [] },
    {
      tests: [
        {
          ...q.tests[0],
          testFiles: [{ path: "../oops.java", content: "", editable: false }],
        },
      ],
    },
  ]) {
    const bad = { ...q, ...change } as Question;
    assert.equal(canArchiveExercise(bad), false);
    assert.throws(() => exerciseFiles(bad, ""));
  }
  assert.throws(() => exerciseFiles(q, "あ".repeat(22000)));
});
