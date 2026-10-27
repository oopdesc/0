import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getProblem } from "../src/problems/index";
import map from "../src/problems/runner-map.json";
import * as java from "../src/generated/problems-model.js";
import { fallbackStars, STAR_COUNT, STAR_SEED } from "../src/orbit/simulation/stars";

test("fixed Java/TeaVM and Rust/Wasm executions agree with each indexed expectation", async () => {
  const { instance } = await WebAssembly.instantiate(
    new Uint8Array(readFileSync(new URL("../public/wasm/problems-rust-a5ba6523c643.wasm", import.meta.url))), {},
  );
  const rust = instance.exports as unknown as {
    memory: WebAssembly.Memory;
    problems_count(): number;
    problems_run(index: number): number;
    problems_len(): number;
  };
  assert.equal(java.problemCount(), map.java.length);
  assert.equal(rust.problems_count(), map.rust.length);
  const normal = (text: string) => text.replace(/\r\n/g, "\n").trimEnd();
  for (const language of ["java", "rust"] as const) {
    for (const entry of map[language]) {
      const problem = getProblem(entry.id)!;
      const expected = problem.expected!;
      let actual: string;
      if (language === "java") actual = java.runProblem(entry.index);
      else {
        const pointer = rust.problems_run(entry.index);
        actual = new TextDecoder().decode(new Uint8Array(rust.memory.buffer, pointer, rust.problems_len()));
      }
      if (expected.runtimeError) {
        assert.equal(actual, "PANIC:" + expected.runtimeError, entry.id);
      } else {
        const output = expected.output?.join("\n") ?? expected.value;
        assert.equal(typeof output, "string", entry.id + " has no output expectation");
        assert.equal(normal(actual), normal(output!), entry.id);
      }
    }
  }
});

test("compiled star generator and fallback agree through the bounded capacity", async () => {
  const { instance } = await WebAssembly.instantiate(
    new Uint8Array(readFileSync(new URL("../public/wasm/orbit-starfield.wasm", import.meta.url))), {},
  );
  const { memory, generate_stars: generate } = instance.exports;
  assert(memory instanceof WebAssembly.Memory);
  assert.equal(typeof generate, "function");
  const make = generate as (seed: number, count: number) => number;
  for (const seed of [0, 42, STAR_SEED, 0xdeadbeef]) {
    for (const count of [0, 1, STAR_COUNT, 4097]) {
      const pointer = make(seed, count);
      const actual = new Float32Array(memory.buffer, pointer, Math.min(count, 4096) * 4).slice();
      assert.deepEqual(actual, fallbackStars(seed, count));
    }
  }
});
