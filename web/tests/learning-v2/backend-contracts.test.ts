import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (url: URL) => JSON.parse(readFileSync(url, "utf8"));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
test("published backend solutions and fixed contracts retain their actual compiler evidence", () => {
  const mutants = read(
    new URL("../fixtures/backend-semantic-mutants.json", import.meta.url),
  );
  for (const lang of ["java", "rust"]) {
    const dir = new URL(
        "../../public/learning-v2/" + lang + "/",
        import.meta.url,
      ),
      manifest = read(new URL("manifest.json", dir));
    const questions = read(new URL("backend-writing.json", dir)),
      ids = new Set(manifest.chunks.flatMap((c: { ids: string[] }) => c.ids));
    for (const q of questions) {
      assert.ok(ids.has(q.id), q.id + " reachable");
      assert.equal(q.evidence.compilerRun.status, "passed");
      assert.equal(
        q.evidence.compilerRun.sourceSha256,
        hash(q.solution.files[0].content),
        q.id + " changed solution needs replay",
      );
      assert.equal(
        q.extensions.fixedTestsSha256,
        hash(JSON.stringify(q.tests[0])),
        q.id + " changed tests need replay",
      );
      assert.ok(
        mutants[q.id] && mutants[q.id] !== q.solution.files[0].content,
        q.id + " has a deliberate wrong implementation",
      );
    }
  }
});
