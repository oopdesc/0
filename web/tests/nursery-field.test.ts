import test from "node:test";
import assert from "node:assert/strict";
import { noiseVolume, renderSize, cameraBasis } from "../src/art/nursery/field";
test("cloud data is deterministic, compact and bounded before any allocation", () => {
  const a = noiseVolume();
  assert.equal(a.byteLength, 48 ** 3);
  assert.deepEqual(a, noiseVolume());
  assert.notDeepEqual(a, noiseVolume(48, 1));
  assert(new Set(a).size > 200);
  for (const size of [0, 7, 65, Infinity, NaN, 48.1])
    assert.throws(() => noiseVolume(size));
});
test("large screens and unusual dimensions never exceed the fixed drawing allocation", () => {
  for (const [w, h] of [
    [390, 520],
    [1920, 1080],
    [8000, 8000],
    [0, 0],
    [-1, 30],
    [NaN, Infinity],
  ]) {
    const size = renderSize(w, h, 3, 720000);
    assert(size.width >= 1 && size.height >= 1);
    assert(size.width * size.height <= 720000);
    const volume = renderSize(w, h, 1, 118000);
    assert(volume.width * volume.height <= 118000);
  }
});
test("camera rotations retain an orthonormal frame and clamp invalid orbit distances", () => {
  for (const [y, p, d] of [
    [0, 0, 4.8],
    [1, 0.5, 3.5],
    [-1, -0.5, 6.8],
    [Infinity, NaN, -1],
  ]) {
    const c = cameraBasis(y, p, d),
      m = c.matrix;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const dot =
          m[i * 3] * m[j * 3] +
          m[i * 3 + 1] * m[j * 3 + 1] +
          m[i * 3 + 2] * m[j * 3 + 2];
        assert(Math.abs(dot - (i === j ? 1 : 0)) < 1e-10);
      }
    const length = Math.hypot(...c.origin);
    assert(length >= 3.5 - 1e-10 && length <= 6.8 + 1e-10);
  }
});
