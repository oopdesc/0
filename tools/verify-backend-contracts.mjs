/** Re-run the published HTTP/JDBC boundary contracts with local compilers.
 * The deliberately wrong programs are test fixtures, not teaching solutions.
 * All execution is sequential; runner limits remain in force. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { grade as javaGrade } from "../contributions/java/runner.mjs";
import { grade as rustGrade } from "../contributions/rust/runner.mjs";
const repo = fileURLToPath(new URL("..", import.meta.url));
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const mutants = await read(
  path.join(repo, "web/tests/fixtures/backend-semantic-mutants.json"),
);
let javaHome = process.env.JAVA_HOME;
if (!javaHome && process.platform === "darwin")
  javaHome = execFileSync("/usr/libexec/java_home", ["-v", "17+"], {
    encoding: "utf8",
  }).trim();
const workDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "zero-backend-contract-"),
);
const records = [];
try {
  for (const [language, grade] of [
    ["java", javaGrade],
    ["rust", rustGrade],
  ]) {
    const dir = path.join(repo, "web/public/learning-v2", language),
      manifest = await read(path.join(dir, "manifest.json"));
    const questions = await read(path.join(dir, "backend-writing.json"));
    for (const q of questions) {
      const request = {
        exerciseId: q.id,
        packVersion: manifest.contentVersion,
        testSetId: "default",
        files: [
          { path: q.setup.files[0].path, content: q.solution.files[0].content },
        ],
      };
      const context = {
        repoRoot: repo,
        workDir,
        toolchains:
          language === "java" && javaHome
            ? {
                java: {
                  javac: path.join(javaHome, "bin/javac"),
                  java: path.join(javaHome, "bin/java"),
                },
              }
            : {},
        limits: { timeoutMs: 8000 },
      };
      const reference = await grade(request, context);
      const mutant = await grade(
        {
          ...request,
          files: [{ path: q.setup.files[0].path, content: mutants[q.id] }],
        },
        context,
      );
      const ok =
        reference.status === "passed" &&
        reference.cases.length === q.tests[0].cases.length &&
        ["failed", "runtime-error"].includes(mutant.status) &&
        mutant.cases.length > 0;
      records.push({ id: q.id, ok, reference, semanticMutant: mutant });
      if (!ok)
        console.error(
          `${q.id}: reference=${reference.status}, mutant=${mutant.status}`,
        );
    }
  }
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "fixed published fixtures; JDBC calls use a recording test double, not a real DB",
    questions: records.length,
    passed: records.filter((r) => r.ok).length,
    cases: records.reduce((n, r) => n + r.reference.cases.length, 0),
    records,
  };
  const output = path.join(repo, ".local/verification");
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "backend-contracts.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Backend contracts: ${report.passed}/${report.questions} references and semantic mutants; ${report.cases} fixed cases.`,
  );
  if (report.passed !== report.questions) process.exitCode = 1;
} finally {
  await fs.rm(workDir, { recursive: true, force: true });
}
