//! ORRERY cosmos kernel — canonical Rust source.
//!
//! Build (on a machine with the Rust toolchain):
//!   rustup target add wasm32-unknown-unknown
//!   cargo build --release --target wasm32-unknown-unknown
//!   cp target/wasm32-unknown-unknown/release/cosmos_kernel.wasm ../public/wasm/
//!
//! This crate has zero dependencies and exports a plain C ABI, so the module
//! stays tiny. The committed WASM binary in `public/wasm/` is generated from
//! `wasm/cosmos_kernel.wat`, a line-by-line translation of the two functions
//! below (the authoring sandbox had no Rust toolchain). Tests in
//! `src/tests/wasm.test.ts` assert that WASM, Rust semantics and the TypeScript
//! reference implementation all agree.
//!
//! SCIENTIFIC NOTE: this is a softened, central-attractor educational model.
//! It is not an n-body solver and not a general-relativistic simulation.

/// One body = 8 f32 words. See `wasm/cosmos_kernel.wat` for the layout:
/// x, y, vx, vy, mass, radius, flags (0 = mover, 1 = fixed), glow.
pub const STRIDE: usize = 8;

#[no_mangle]
pub extern "C" fn stride() -> i32 {
    STRIDE as i32
}

/// Deterministic integer hash in [0, 1). Mirrors `hash01` in `src/core/rng.ts`.
#[no_mangle]
pub extern "C" fn hash01(i: i32, seed: i32) -> f32 {
    let mut x = ((i ^ seed).wrapping_mul(0x27d4_eb2d) ^ 0x85eb_ca6b) as u32;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2c1b_3c6d);
    x ^= x >> 12;
    x as f32 / 4_294_967_296.0f32
}

/// Advance every non-fixed body by one semi-implicit Euler step.
///
/// # Safety
/// `ptr` must point to `count * STRIDE` writable f32 values in WASM linear
/// memory. The first `na` bodies are treated as immovable attractors.
#[no_mangle]
pub unsafe extern "C" fn step(
    ptr: *mut f32,
    count: i32,
    na: i32,
    g: f32,
    dt: f32,
    soft: f32,
    maxv: f32,
) {
    if ptr.is_null() || count <= 0 || na <= 0 || dt == 0.0 {
        return;
    }
    let soft2 = soft * soft;
    let maxv2 = maxv * maxv;
    let n = count as isize;
    let na = na.min(count) as isize;

    for i in 0..n {
        let bi = ptr.offset(i * STRIDE as isize);
        if *bi.add(6) != 0.0 {
            continue; // fixed attractor / static artwork
        }
        let mut x = *bi.add(0);
        let mut y = *bi.add(1);
        let mut vx = *bi.add(2);
        let mut vy = *bi.add(3);
        let mut ax = 0.0f32;
        let mut ay = 0.0f32;

        for j in 0..na {
            let bj = ptr.offset(j * STRIDE as isize);
            let dx = *bj.add(0) - x;
            let dy = *bj.add(1) - y;
            let r2 = dx * dx + dy * dy + soft2;
            let f = g * (*bj.add(4)) / (r2 * r2.sqrt());
            ax += dx * f;
            ay += dy * f;
        }

        vx += ax * dt;
        vy += ay * dt;
        let sp2 = vx * vx + vy * vy;
        if sp2 > maxv2 {
            let scale = maxv / sp2.sqrt();
            vx *= scale;
            vy *= scale;
        }
        x += vx * dt;
        y += vy * dt;

        *bi.add(0) = x;
        *bi.add(1) = y;
        *bi.add(2) = vx;
        *bi.add(3) = vy;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_deterministic_and_bounded() {
        assert_eq!(hash01(0, 1), hash01(0, 1));
        assert!(hash01(7, 99) >= 0.0 && hash01(7, 99) < 1.0);
    }

    #[test]
    fn a_body_falls_toward_an_attractor() {
        let mut data: [f32; 16] = [
            0.0, 0.0, 0.0, 0.0, 1000.0, 10.0, 1.0, 0.0, // attractor
            100.0, 0.0, 0.0, 0.0, 1.0, 2.0, 0.0, 0.0, // mover
        ];
        unsafe { step(data.as_mut_ptr(), 2, 1, 1.0, 0.01, 8.0, 400.0) };
        assert!(data[8] < 100.0, "mover must move toward the attractor");
        assert!(data[10] < 0.0, "velocity must point toward the attractor");
    }
}
