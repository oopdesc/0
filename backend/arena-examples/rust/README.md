# Rust / WASM kernel

`src/lib.rs` is the **canonical, human-maintained** implementation of the
deterministic gravity/hash kernel. It has zero crates.io dependencies and
exports a plain C ABI so the resulting module stays tiny.

## Build (on a machine with Rust)

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/cosmos_kernel.wasm \
   ../public/wasm/cosmos_kernel.wasm
cargo test          # host-side unit tests for hash01 + step
```

The host (`src/core/wasmKernel.ts`) expects these exports:

| Export | Signature |
| --- | --- |
| `memory` | exported linear memory |
| `stride()` | `() -> i32`, must return `8` |
| `hash01(i, seed)` | `(i32, i32) -> f32`, deterministic value in `[0,1)` |
| `step(ptr, count, na, g, dt, soft, maxv)` | `(i32,i32,i32,f32,f32,f32,f32) -> ()` |

Memory layout per body (8 × f32, 32 bytes):
`x, y, vx, vy, mass, radius, flags, glow`. `flags = 1.0` marks a fixed
attractor; `0.0` marks a free mover. The first `na` bodies are the attractors.

## Why the committed `.wasm` came from WAT

The authoring sandbox had **no Rust toolchain**. To ship a real, executable
WASM module rather than a fake one, `wasm/cosmos_kernel.wat` was written as a
line-by-line translation of this Rust source and compiled with `wabt` by
`npm run build:wasm`. `src/tests/simulation.test.ts` proves the resulting
module's `hash01` matches the TypeScript reference for 200 inputs and its
`step` matches within float tolerance.

If you rebuild from Rust, re-run `npm test` — the ABI check in
`loadWasmKernel()` will reject a module that does not match.

## Model

Softened central-attractor gravity with semi-implicit Euler and a velocity
clamp. **Educational model.** Not an n-body solver, not observational data,
not general relativity.
