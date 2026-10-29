import test from "node:test";
import assert from "node:assert/strict";
import {
  emptySky,
  validateSky,
  chooseSky,
  activeSky,
  readSky,
  SKY_IDS,
} from "../src/art/sky-state";
test("six scenes can apply globally or to a single page without leaking page overrides", () => {
  let s = emptySky();
  assert.equal(activeSky(s, "/learn"), null);
  for (const id of SKY_IDS) {
    s = chooseSky(s, "/", id, "all");
    assert.equal(activeSky(s, "/learn"), id);
    assert.equal(activeSky(s, "/art"), id);
  }
  s = chooseSky(s, "/learn", "solar", "page");
  assert.equal(activeSky(s, "/learn"), "solar");
  assert.equal(activeSky(s, "/art"), "milkyway");
  s = chooseSky(s, "/", "nursery", "all");
  assert.equal(activeSky(s, "/learn"), "nursery");
  assert.deepEqual(s.pages, {});
  const stopped = validateSky({ ...s, paused: true, strength: 8 });
  assert.equal(stopped.paused, true);
  assert.equal(stopped.strength, 8);
});
test("malformed and oversized appearance data never becomes a route or a file path", () => {
  for (const strength of [0, 73, Infinity, NaN, 23.5])
    assert.throws(() => validateSky({ ...emptySky(), strength }));
  assert.throws(() =>
    chooseSky(emptySky(), "https://other.test", "nursery", "page"),
  );
  assert.throws(() => validateSky({ ...emptySky(), global: "unknown" }));
  assert.throws(() =>
    validateSky({ ...emptySky(), pages: JSON.parse('{"__proto__":"solar"}') }),
  );
  assert.equal(readSky({ getItem: () => "{broken" }).writable, false);
  assert.equal(readSky({ getItem: () => "x".repeat(8001) }).writable, false);
  assert.deepEqual(readSky({ getItem: () => null }).state, emptySky());
});
