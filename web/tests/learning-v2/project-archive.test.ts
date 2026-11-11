import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { makeProjectArchive } from "../../src/learning-v2/projectArchive";
import { makeWorkplaceArchive } from "../../src/learning-v2/workplaceArchive";
import {
  projectHref,
  projectSelection,
} from "../../src/learning-v2/projectNavigation";
import type { Project } from "../../src/learning-v2/types";
const bundle = JSON.parse(
  readFileSync(
    new URL(
      "../../public/learning-v2/java/examples/projects/mission-books-id.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("project download is a real ZIP of the matching starter and fixed test sources", () => {
  const out = unzipSync(makeProjectArchive(bundle, "java:mission-books-id"));
  assert.ok(strFromU8(out["COPYRIGHT.txt"]).includes("商用転用には事前の許諾"));
  assert.ok(strFromU8(out["README-START.md"]).includes("展開先のルートで実行"));
  assert.ok(
    strFromU8(
      out[
        "backend/java-learning-v2/src/main/java/zero/learning/BookService.java"
      ],
    ).includes('UnsupportedOperationException("TODO")'),
  );
  assert.ok(
    strFromU8(
      out[
        "backend/java-learning-v2/src/test/java/zero/learning/BookFlowTest.java"
      ],
    ).includes("validateIds"),
  );
  assert.ok(
    Object.keys(out).every(
      (p) => !p.includes("/target/") && !p.endsWith(".class"),
    ),
  );
});
test("project archive refuses traversal, duplicate paths, oversized entries and wrong mission", () => {
  const altered = structuredClone(bundle);
  altered.files[0].path = "../secret.java";
  assert.throws(() => makeProjectArchive(altered, bundle.missionId));
  const dup = structuredClone(bundle);
  dup.files.push(dup.files[0]);
  assert.throws(() => makeProjectArchive(dup, bundle.missionId));
  const large = structuredClone(bundle);
  large.files[0].content = "x".repeat(200_001);
  assert.throws(() => makeProjectArchive(large, bundle.missionId));
  assert.throws(() => makeProjectArchive(bundle, "java:mission-other"));
});

test("working project ZIP overlays only existing source paths, preserves its original bundle, and labels the result unexecuted", () => {
  const original = JSON.stringify(bundle);
  const file =
    "backend/java-learning-v2/src/main/java/zero/learning/BookService.java";
  const out = unzipSync(
    makeProjectArchive(bundle, bundle.missionId, {
      [file]: "// my current draft",
    }),
  );
  assert.equal(strFromU8(out[file]), "// my current draft");
  assert.ok(strFromU8(out["WORK-IN-PROGRESS.md"]).includes("未実行"));
  assert.equal(JSON.stringify(bundle), original);
  assert.ok(
    out[
      "backend/java-learning-v2/src/test/java/zero/learning/BookFlowTest.java"
    ],
  );
  assert.throws(() =>
    makeProjectArchive(bundle, bundle.missionId, {
      "README-START.md": "overwrite instructions",
    }),
  );
  assert.throws(() =>
    makeProjectArchive(bundle, bundle.missionId, {
      "backend/java-learning-v2/src/main/java/Unknown.java": "not present",
    }),
  );
  assert.throws(() =>
    makeProjectArchive(bundle, bundle.missionId, {
      [file]: "x".repeat(200001),
    }),
  );
});

test("every real project mission survives a shareable URL and missing missions fall back explicitly", () => {
  for (const lang of ["java", "rust"] as const) {
    const projects = JSON.parse(
      readFileSync(
        new URL(
          `../../public/learning-v2/${lang}/projects.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ) as Project[];
    projects.forEach((project, pi) =>
      project.missions.forEach((mission, mi) => {
        const href = projectHref(lang, project.id, mission.id);
        const selected = projectSelection(projects, href.split("?")[1]);
        assert.deepEqual(selected, {
          projectIndex: pi,
          missionIndex: mi,
          missing: false,
        });
      }),
    );
    assert.equal(projectSelection(projects, "mission=unknown").missing, true);
    assert.equal(projectSelection(projects, "project=unknown").projectIndex, 0);
  }
});

const rustBundle = JSON.parse(
  readFileSync(
    new URL(
      "../../public/learning-v2/rust/examples/projects/mission-http-json.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("Rust mission ZIP carries its starter, locked dependencies and real test, without Java paths", () => {
  const out = unzipSync(makeProjectArchive(rustBundle, rustBundle.missionId));
  assert.ok(out["projects/rust/book-api-http/Cargo.lock"]);
  assert.ok(
    strFromU8(out["projects/rust/book-api-http/src/main.rs"]).includes(
      "mission_json",
    ),
  );
  assert.ok(strFromU8(out["README-START.md"]).includes("cargo test"));
  assert.ok(!Object.keys(out).some((p) => p.startsWith("backend/")));
  const wrong = structuredClone(rustBundle);
  wrong.files[1].path = "backend/java-learning-v2/pom.xml";
  assert.throws(() => makeProjectArchive(wrong, wrong.missionId));
  assert.throws(() => makeProjectArchive(rustBundle, "java:mission-http-json"));
});

test("practical Java/Rust archive contains exact source and real failing starter tests, never compiled artifacts", () => {
  const bundle = JSON.parse(
    readFileSync(
      new URL(
        "../../public/learning-v2/workplace-starter.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const out = unzipSync(makeWorkplaceArchive(bundle));
  assert.equal(Object.keys(out).length, 7);
  assert.ok(
    strFromU8(out["workplace-java/BookService.java"]).includes("TODO validId"),
  );
  assert.ok(
    strFromU8(out["workplace-rust/src/lib.rs"]).includes(
      "two_readers_cannot_silently_overwrite",
    ),
  );
  assert.ok(strFromU8(out["README-START.md"]).includes("--offline -j 2"));
  assert.ok(strFromU8(out["COPYRIGHT.txt"]).includes("商用転用には事前の許諾"));
  const mapping = [
    ["workplace-java/BookService.java", "java/BookService.java"],
    ["workplace-java/WorkplaceTest.java", "java/WorkplaceTest.java"],
    ["workplace-rust/Cargo.toml", "rust/Cargo.toml"],
    ["workplace-rust/src/lib.rs", "rust/src/lib.rs"],
    ["README-START.md", "README-START.md"],
    ["SOLUTION.md", "SOLUTION.md"],
  ];
  for (const [name, source] of mapping)
    assert.equal(
      strFromU8(out[name]),
      readFileSync(
        new URL("../../practical/" + source, import.meta.url),
        "utf8",
      ),
    );
  const bad = structuredClone(bundle);
  bad.files[0].path = "../secret";
  assert.throws(() => makeWorkplaceArchive(bad));
  const dup = structuredClone(bundle);
  dup.files[1] = dup.files[0];
  assert.throws(() => makeWorkplaceArchive(dup));
  assert.throws(() =>
    makeWorkplaceArchive({ schema: "zero-workplace-starter/1", files: [] }),
  );
});
