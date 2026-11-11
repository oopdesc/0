import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sources from "../../src/generated/site-sources.json";

test("embedded Java/Rust files and reading cues match the current source", () => {
  const deployed = JSON.parse(readFileSync(new URL("../../public/learning-v2/site-sources.json", import.meta.url), "utf8"));
  assert.deepEqual(deployed, sources);
  assert.equal(sources.length, 6);
  for (const source of sources) {
    assert.match(
      source.path,
      /^(frontend\/java\/|backend\/rust\/|projects\/(java|rust)\/)/,
    );
    const original = readFileSync(
      new URL("../../../" + source.path, import.meta.url),
      "utf8",
    );
    assert.equal(source.content, original);
    assert.equal(
      source.sha256,
      createHash("sha256").update(original).digest("hex"),
    );
    for (const cue of source.cues)
      assert.ok(original.split("\n")[cue.line - 1].trim().length > 0);
  }
});
