import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLearningInventory } from "../tools/learning-inventory";
import { buildJourneyOrder } from "../tools/journey-order";
import { validateCatalog } from "../src/learning-v2/catalog";
import {
  emptyJourney,
  completeJourney,
  mergeJourney,
  validateJourney,
  readJourney,
  saveJourney,
  validateJourneyOrder,
  journeyHref,
  JOURNEY_KEY,
} from "../src/learning-v2/journey-state";
import {
  recordKey,
  recordPrediction,
  recordManualCodeCheck,
  importProgress,
  emptyProgress,
} from "../src/learning-v2/progress";
const read = (file: string) =>
  JSON.parse(
    readFileSync(
      new URL("../public/learning-v2/" + file, import.meta.url),
      "utf8",
    ),
  );
test("the continuous course covers every unique group exactly once and respects known prerequisites", () => {
  const { groups } = buildLearningInventory(),
    order = buildJourneyOrder(groups),
    catalog = validateCatalog(read("catalog.json"));
  assert.equal(order.length, 2098);
  assert.equal(new Set(order).size, groups.length);
  assert.deepEqual(read("journey.json").order, order);
  const positions = new Map(order.map((index, position) => [index, position])),
    teachers = new Map<string, number>();
  groups.forEach((g, i) =>
    g.forEach((q) =>
      q.introduces?.forEach((id) => {
        if (!teachers.has(id)) teachers.set(id, i);
      }),
    ),
  );
  let edges = 0;
  groups.forEach((g, i) =>
    g.forEach((q) =>
      q.prerequisites?.forEach((id) => {
        const t = teachers.get(id);
        if (t !== undefined && t !== i) {
          edges++;
          assert(
            positions.get(t)! < positions.get(i)!,
            `${id} before ${q.key}`,
          );
        }
      }),
    ),
  );
  assert(edges > 100);
  const items = validateJourneyOrder(read("journey.json"), catalog);
  assert.equal(items[0].id, "java:q0001");
  assert.equal(items.filter((x) => x.language === "rust").length, 712);
  for (const item of items)
    assert.equal(
      new URL(journeyHref(item), "https://example.test").searchParams.get(
        "step",
      ),
      item.id,
    );
  const wrong = read("journey.json");
  wrong.order[0] = wrong.order[1];
  assert.throws(() => validateJourneyOrder(wrong, catalog));
});
test("one question adds one level, repeat/assisted/compiler evidence merge without fake extra levels", () => {
  const known = new Set(["java:q0001", "rust:q20001"]);
  const a = completeJourney(
    emptyJourney(),
    "java:q0001",
    "self-check",
    known,
    100,
  );
  const b = completeJourney(a, "java:q0001", "correct", known, 200);
  assert.equal(Object.keys(b.records).length, 1);
  assert.equal(b.records["java:q0001"].evidence, 9);
  assert.equal(b.records["java:q0001"].evidence & 4, 0);
  const c = completeJourney(
    emptyJourney(),
    "rust:q20001",
    "code-passed",
    known,
    300,
  );
  const merged = mergeJourney(b, c);
  assert.equal(Object.keys(merged.records).length, 2);
  assert.deepEqual(mergeJourney(c, b), merged);
  assert.deepEqual(mergeJourney(merged, merged), merged);
  assert.throws(() => completeJourney(a, "unknown", "correct", known));
});
test("corrupt/prototype/oversized/unknown imports are rejected; corrupt existing storage is never overwritten", () => {
  assert.throws(() =>
    validateJourney(
      JSON.parse(
        '{"schema":"zero-journey-progress/1","records":{"__proto__":{"at":1,"evidence":1}}}',
      ),
    ),
  );
  for (const evidence of [-1, 0, 16, 1.5, Infinity])
    assert.throws(() =>
      validateJourney({
        schema: "zero-journey-progress/1",
        records: { "java:q0001": { at: 1, evidence } },
      }),
    );
  const p = completeJourney(
    emptyJourney(),
    "java:q0001",
    "correct",
    new Set(["java:q0001"]),
    100,
  );
  assert.throws(() => validateJourney(p, new Set(["rust:q20001"])));
  let raw = "{broken",
    writes = 0;
  const s = {
    getItem: () => raw,
    setItem: (_k: string, v: string) => {
      writes++;
      raw = v;
    },
  };
  assert.equal(readJourney(s).writable, false);
  assert.throws(() => saveJourney(s, p));
  assert.equal(writes, 0);
  assert.equal(raw, "{broken");
  raw = JSON.stringify(
    completeJourney(
      emptyJourney(),
      "rust:q20001",
      "self-check",
      new Set(["rust:q20001"]),
      200,
    ),
  );
  const saved = saveJourney(s, p);
  assert.equal(writes, 1);
  assert.equal(Object.keys(saved.records).length, 2);
  assert.throws(() =>
    saveJourney(
      {
        ...s,
        setItem: () => {
          throw Error("quota");
        },
      },
      p,
    ),
  );
  assert.equal(JOURNEY_KEY, "0.journey.progress.v1");
});
test("single-question exam practice preserves valid draft/answer records without changing timed exam state", () => {
  const key = recordKey("java:bronze-A:q1", "v1", "prediction"),
    p = recordPrediction(emptyProgress(), key, true, Date.now());
  assert.equal(p.records[key].blindCorrect, 1);
  assert.equal(importProgress(JSON.stringify(p), emptyProgress()).ok, true);
  const code = recordKey("rust:advanced-B:q12", "v1", "code"),
    m = recordManualCodeCheck(p, code);
  assert.equal(m.records[code].manualCodeChecks, 1);
  assert.equal(m.records[code].codePasses ?? 0, 0);
  assert.equal(importProgress(JSON.stringify(m), emptyProgress()).ok, true);
});
