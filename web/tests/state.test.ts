import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  parseState,
  filterResources,
  normalize,
} from "../src/state.ts";
import { resources } from "../src/data.ts";
import { lessons } from "../src/lessons.ts";
import { LESSON_IDS } from "../src/lesson-ids.ts";
test("broken data cannot crash the application", () => {
  for (const v of [
    null,
    "{",
    "null",
    "[]",
    "123",
    '{"schema":2}',
    "x".repeat(12001),
  ])
    assert.deepEqual(parseState(v), emptyState());
});
test("unknown IDs and duplicate values do not become saved progress", () =>
  assert.deepEqual(
    parseState(
      '{"schema":1,"favorites":["github","github","private",3],"completed":["java-http","wrong"],"motion":"invalid"}',
    ),
    {
      schema: 1,
      favorites: ["github"],
      completed: ["java-http"],
      motion: "auto",
      reviews: {},
    },
  ));
test("search handles Japanese width and case", () => {
  assert.equal(normalize(" ＪＡＶＡ "), "java");
  const wide = filterResources("ＪＡＶＡ", "すべて", [], false).map(
    (x) => x.id,
  );
  assert(wide.includes("java"));
  assert.deepEqual(
    wide,
    filterResources("java", "すべて", [], false).map((x) => x.id),
  );
});
test("favorite filtering and categories compose", () => {
  assert.equal(filterResources("", "リンク", ["github"], true).length, 1);
  assert.equal(filterResources("", "学習", ["github"], true).length, 0);
});
test("missing result is an empty list", () =>
  assert.deepEqual(filterResources("存在しない", "すべて", [], false), []));
test("curriculum and resource IDs are unique", () => {
  assert.equal(new Set(lessons.map((x) => x.id)).size, lessons.length);
  assert.equal(new Set(resources.map((x) => x.id)).size, resources.length);
});
test("paused motion survives a valid roundtrip", () =>
  assert.equal(
    parseState(JSON.stringify({ ...emptyState(), motion: "paused" })).motion,
    "paused",
  ));
test("saved progress cannot mutate the teaching source", () => {
  const before = JSON.stringify(lessons);
  parseState('{"schema":1,"completed":["java-http"]}');
  assert.equal(JSON.stringify(lessons), before);
});

test("public lesson IDs and validation rules stay aligned", () =>
  assert.deepEqual(
    lessons.map((x) => x.id),
    [...LESSON_IDS],
  ));
