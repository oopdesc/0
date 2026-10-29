import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLearningInventory } from "../tools/learning-inventory";
import {
  catalogHref,
  catalogState,
  catalogSearch,
  searchCatalog,
  validateCatalog,
} from "../src/learning-v2/catalog";
import { PROBLEMS } from "../src/academy/content";
const raw = () =>
  JSON.parse(
    readFileSync(
      new URL("../public/learning-v2/catalog.json", import.meta.url),
      "utf8",
    ),
  );
test("all unique questions, including code alternatives, have a real address to their selected source", () => {
  const items = validateCatalog(raw()),
    inventory = buildLearningInventory();
  assert.equal(items.length, inventory.summary.total);
  const origins = new Map(inventory.groups.flat().map((q) => [q.key, q]));
  assert.deepEqual(
    new Set(items.map((q) => q.id)),
    new Set(inventory.groups.map((g) => g[0].key)),
  );
  for (const q of items) {
    assert.equal(origins.get(q.id)!.language, q.language);
    assert(catalogHref(q.id, q.language).startsWith("/learn?"));
    if (q.codeKey) {
      assert.equal(origins.get(q.codeKey)!.writing, true);
      assert.equal(origins.get(q.codeKey)!.language, q.language);
    }
  }
  assert.equal(
    items.filter((q) => q.codeKey).length,
    inventory.summary.writing,
  );
  const hardIds = new Set(
    PROBLEMS.filter((q) => q.level >= 4).map((q) => "academy:" + q.id),
  );
  const hard = inventory.groups.flat().filter((q) => hardIds.has(q.key));
  assert(hard.length > 0);
  assert(
    hard.every((q) => q.level === "advanced"),
    "advanced supplemental questions must not become beginner",
  );
  for (const p of PROBLEMS) {
    const q = origins.get("academy:" + p.id)!;
    assert.equal(
      q.level,
      p.level <= 2 ? "beginner" : p.level === 3 ? "intermediate" : "advanced",
    );
  }
});
test("catalogue filters and pagination survive a shared URL or browser back without storing learning records", () => {
  const filter = {
    language: "rust",
    level: "advanced",
    kind: "code",
    source: "exam",
    query: "所有権 & 型",
  };
  const url = catalogSearch(filter, 3);
  assert.deepEqual(catalogState(url.slice(url.indexOf("?"))), {
    filter,
    page: 3,
  });
  const bad = catalogState(
    "?lang=no&level=4&kind=wat&source=remote&page=-2&query=" +
      encodeURIComponent("a".repeat(180)),
  );
  assert.equal(bad.page, 0);
  assert.equal(bad.filter.language, "all");
  assert.equal(bad.filter.level, "all");
  assert.equal(bad.filter.query.length, 160);
});
test("catalogue filtering composes language, level, writing and Japanese search without changing the original index", () => {
  const items = validateCatalog(raw()),
    before = JSON.stringify(items);
  const only = searchCatalog(items, {
    language: "rust",
    level: "beginner",
    kind: "code",
    source: "all",
    query: "",
  });
  assert(only.length > 0);
  assert(
    only.every(
      (q) => q.language === "rust" && q.level === "beginner" && q.codeKey,
    ),
  );
  assert.equal(
    searchCatalog(items, {
      language: "all",
      level: "all",
      kind: "all",
      source: "all",
      query: "not-a-real-problem-87454811",
    }).length,
    0,
  );
  const q = items[0];
  assert(
    searchCatalog(items, {
      language: "all",
      level: "all",
      kind: "all",
      source: "all",
      query: q.id.toUpperCase(),
    }).some((v) => v.id === q.id),
  );
  assert.equal(JSON.stringify(items), before);
  const topicOnly = items.find(
    (q) => q.topics.includes("所有権") && !q.title.includes("所有権"),
  );
  assert(topicOnly);
  assert(
    searchCatalog(items, {
      language: "all",
      level: "all",
      kind: "all",
      source: "all",
      query: "所有権",
    }).some((q) => q.id === topicOnly.id),
  );
});
test("direct links preserve question identity, and reject unknown URLs, traversal and cross-language normal questions", () => {
  assert(catalogHref("academy:j-core-03b", "java").endsWith("#/p/j-core-03b"));
  assert.match(
    catalogHref("practice:b-mem1", "java"),
    /lang=bridge&legacyQuestion=b-mem1/,
  );
  assert.match(
    catalogHref("java:exam-bronze-a:q001", "java"),
    /exam=java%3Aexam-bronze-a&examQuestion=java%3Aexam-bronze-a%3Aq001/,
  );
  for (const id of [
    "https://elsewhere",
    "academy:../../secret",
    "java:q0001@old",
    "rust:q0001",
  ])
    assert.throws(() => catalogHref(id, "java"));
  const d = raw();
  d.items.push(d.items[0]);
  d.total++;
  assert.throws(() => validateCatalog(d));
  const e = raw();
  e.items[0][5] = "javascript:alert(1)";
  assert.throws(() => validateCatalog(e));
  const f = raw();
  f.total++;
  assert.throws(() => validateCatalog(f));
  const g = raw();
  g.items[0][6] = ["not a text topic"];
  assert.throws(() => validateCatalog(g));
});
