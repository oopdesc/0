const wasmMeta = {"problems": {"url": "/wasm/problems-rust-a5ba6523c643.wasm", "sha256": "a5ba6523c6433c579bac243482af5e4dded96db4283dd97e1f56c61a33493439", "bytes": 65953, "sourceHashes": {"backend/rust/Cargo.toml": "9683489c1c3ecbe99a4a37ec6afb2f4f4a2eb5b03213faadb4f1a8760499d9ff", "backend/rust/cosmic-problems/Cargo.toml": "fdcbf45ae24bc8ab482c1d879ce991e86356a066ac0f6a9225e7c74fb04e6191", "backend/rust/cosmic-problems/src/lib.rs": "b82e419a542624c518fd7a58e083eb46936dfbc54a6168cd16d9797a528fb8b1", "backend/rust/cosmic-problems/src/problems.rs": "214789030bfdd63c9f396558e518f5ec599e1b1e935a98f0e9d84224946d8086", "backend/rust/cosmic-problems/src/wasm_api.rs": "cc5248882fadfe478e6afb9a8760ec7a70e7dc49e6e564e48bb5506fc510f726", "web/src/problems/runner-map.json": "b24dc4fd181ace92132eef8279e0717b1cb8314cc6b5c85c2837e7e4e46dc3db", "web/tools/gen-runners.mjs": "c9524b3ea9bed534ad60a60fd8b9aa88c1d65a14917d916c24cb833a3658303b"}}};
import runnerMapJson from "./runner-map.json";

/**
 * Browser runners for the curated problem bundle.
 *
 * Java problems run inside a TeaVM build of real Java sources
 * (`frontend/java-problems`); Rust problems run inside a real
 * `wasm32-unknown-unknown` build of the same dataset
 * (`backend/rust/cosmic-problems`). Both bundles are produced from
 * `web/src/problems/**` by `web/tools/gen-runners.mjs`, and both are
 * verified against javac/rustc by `tools/verify-problems.mjs`.
 *
 * Nothing here compiles or evaluates user input. The runner only
 * executes fixed, curated snippets chosen by index.
 */

export type RunnerMap = {
  generatedFrom: string;
  counts: Record<string, number>;
  java: Array<{ index: number; id: string; language: string }>;
  rust: Array<{ index: number; id: string; language: string }>;
};

export const runnerMap: RunnerMap = runnerMapJson as RunnerMap;
const map = runnerMap;

export function runnerIndex(
  language: "java" | "rust",
  id: string,
): number | undefined {
  const entry = map[language].find((x) => x.id === id);
  return entry ? entry.index : undefined;
}

export function runnerCoverage(language: "java" | "rust"): string[] {
  return map[language].map((x) => x.id);
}

/** Shared decode helper: the Rust runner writes UTF-8 bytes into a fixed buffer. */
function decodeWasmString(exports: RustProblemsExports, pointer: number, len: number) {
  const buffer = exports.memory.buffer;
  return new TextDecoder().decode(new Uint8Array(buffer, pointer, len));
}

export type JavaProblemsModule = {
  problemCount(): number;
  runProblem(index: number): string;
};

export type RustProblemsExports = {
  memory: WebAssembly.Memory;
  problems_count: () => number;
  problems_run: (index: number) => number;
  problems_len: () => number;
};

let javaPending: Promise<JavaProblemsModule> | undefined;
let rustPending: Promise<RustProblemsExports> | undefined;

/** Lazy: the TeaVM bundle is a separate chunk and only loads on a Java problem. */
export function loadJavaProblems(): Promise<JavaProblemsModule> {
  javaPending ??= import("../generated/problems-model.js")
    .then((module: JavaProblemsModule) => {
      if (typeof module.runProblem !== "function") {
        throw Error("Java problem runner unavailable");
      }
      return module;
    })
    .catch((error: unknown) => {
      javaPending = undefined;
      throw error;
    });
  return javaPending;
}

/** Lazy: the problem WASM is fetched only when a Rust problem is opened. */
export function loadRustProblems(): Promise<RustProblemsExports> {
  rustPending ??= fetch(wasmMeta.problems.url)
    .then(async (response) => {
      if (!response.ok) throw Error(`problem wasm HTTP ${response.status}`);
      return WebAssembly.instantiate(await response.arrayBuffer(), {});
    })
    .then((compiled) => {
      const exports = compiled.instance.exports as unknown as RustProblemsExports;
      if (typeof exports.problems_run !== "function") {
        throw Error("Rust problem runner unavailable");
      }
      return exports;
    })
    .catch((error: unknown) => {
      rustPending = undefined;
      throw error;
    });
  return rustPending;
}

export async function runJavaProblem(index: number): Promise<string> {
  const module = await loadJavaProblems();
  return String(module.runProblem(index));
}

export async function runRustProblem(index: number): Promise<string> {
  const exports = await loadRustProblems();
  const pointer = exports.problems_run(index);
  const length = exports.problems_len();
  if (!pointer || !length) return "";
  return decodeWasmString(exports, pointer, length);
}

/** Run one problem by dataset id. Returns null when the problem has no browser runner. */
export async function runProblem(
  id: string,
  language: "java" | "rust",
): Promise<string | null> {
  const index = runnerIndex(language, id);
  if (index === undefined) return null;
  return language === "java" ? runJavaProblem(index) : runRustProblem(index);
}

export function describeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "ブラウザで実行モジュールを読み込めませんでした。";
  }
  return `実行できませんでした。${message}`;
}
