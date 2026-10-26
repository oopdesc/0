import assert from "node:assert/strict";
import test from "node:test";
import { lstatSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { lessons } from "../src/lessons";
import { resources } from "../src/data";

test("every lesson points to an existing regular public source file", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const lesson of lessons) {
    const parts = lesson.file.split("/");
    // Reject private/escaping names before accessing any component or following a link.
    assert(!path.isAbsolute(lesson.file));
    assert(
      parts.every(
        (p) =>
          p &&
          p !== "." &&
          p !== ".." &&
          !p.startsWith("[") &&
          !p.startsWith("."),
      ),
    );
    assert(/\.(java|rs|ts|tsx|mjs)$/.test(lesson.file));
    let current = root;
    for (const part of parts) {
      current = path.join(current, part);
      assert(
        !lstatSync(current).isSymbolicLink(),
        "Linked teaching source refused",
      );
    }
    const status = lstatSync(current);
    assert(
      status.isFile() && status.nlink === 1,
      "Source must be a regular unlinked file",
    );
  }
});

test("curated resource links cannot run scripts or include credentials", () => {
  for (const resource of resources) {
    assert(!resource.href.startsWith("//"));
    const url = new URL(resource.href, "https://0-3gaz.vercel.app");
    assert.equal(url.protocol, "https:");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
    for (const key of url.searchParams.keys())
      assert(!/token|password|secret|api.?key|rlkey/i.test(key));
  }
});
