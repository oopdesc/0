# WASM kernel source

- `cosmos_kernel.wat` — original WebAssembly text module, hand-authored as a
  line-by-line translation of `../rust/src/lib.rs`.
- Built output: `../public/wasm/cosmos_kernel.wasm` (488 bytes), produced by
  `npm run build:wasm` (`scripts/build-wasm.mjs` + `wabt`).

The build is deterministic: the same WAT produces byte-identical WASM. The
script also instantiates the result in Node and asserts that `memory`, `step`,
`hash01` and `stride` are exported and that `stride() === 8`.

Do not edit the `.wasm` by hand. Edit the WAT (or the Rust source, then
re-translate) and rebuild.

See `../rust/README.md` for the ABI contract and
`../src/core/wasmKernel.ts` for the host-side validation and TypeScript
fallback.
