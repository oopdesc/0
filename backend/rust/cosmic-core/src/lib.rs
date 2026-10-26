//! 銀河の形をつくる小さな数理モデル。天体物理の正確なシミュレーションではありません。
//! 純粋関数で形を生成し、同じ実装をネイティブのテスト・HTTP API・Wasmで利用します。
use std::f32::consts::TAU;
use std::sync::Mutex;

pub const MAX_PARTICLES: usize = 32000;
pub const STRIDE: usize = 4;

/// x, y, z, brightness を連続するf32として返す。seedが同じなら結果も同じです。
pub fn galaxy(count: usize, seed: u32) -> Vec<f32> {
    let count = count.min(MAX_PARTICLES);
    let mut state = seed.max(1);
    let mut random = || {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        state as f32 / u32::MAX as f32
    };
    let mut out = Vec::with_capacity(count * STRIDE);
    for i in 0..count {
        let central = i % 5 == 0;
        let r = if central {
            random().powi(2) * 0.28
        } else {
            random().powf(0.65)
        };
        let arm = (i % 2) as f32 * TAU / 2.0;
        let angle = if !central && i % 4 == 0 {
            random() * TAU
        } else {
            arm + r * 5.7 + (random() + random() + random() - 1.5) * (0.65 + r * 0.7)
        };
        let scatter = (1.0 - r) * 0.1;
        out.extend_from_slice(&[
            r * angle.cos() + (random() - 0.5) * scatter,
            r * angle.sin() + (random() - 0.5) * scatter,
            (random() + random() - 1.0)
                * if central {
                    0.13
                } else {
                    0.024 + (1.0 - r) * 0.025
                },
            0.35 + random() * 0.65,
        ]);
    }
    out
}

/// 描画用の降着円盤・背景の星。重力計算ではなく、上限付きの再現可能な形の生成。
pub fn cloud(mode: u32, count: usize, seed: u32) -> Vec<f32> {
    if mode == 0 || mode == 2 {
        return galaxy(count, seed);
    }
    let mut state = seed.max(1);
    let mut random = || {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        state as f32 / u32::MAX as f32
    };
    let mut out = Vec::with_capacity(count.min(MAX_PARTICLES) * STRIDE);
    for _ in 0..count.min(MAX_PARTICLES) {
        let angle = random() * TAU;
        if mode == 1 {
            let r = 0.235 + random().powf(0.8) * 0.85;
            out.extend_from_slice(&[
                r * angle.cos(),
                r * angle.sin(),
                (random() + random() - 1.0) * 0.018,
                0.3 + random() * 0.7,
            ]);
        } else {
            let z = random() * 2.0 - 1.0;
            let radius = 6.0 + random() * 9.0;
            let horizontal = (1.0 - z * z).sqrt();
            out.extend_from_slice(&[
                radius * horizontal * angle.cos(),
                radius * horizontal * angle.sin(),
                radius * z,
                0.2 + random() * 0.8,
            ]);
        }
    }
    out
}

/// 入力を上限付きで解釈する。巨大な要求でメモリを使い切らないための境界です。
pub fn requested_count(value: &str) -> Result<usize, &'static str> {
    let count: usize = value.parse().map_err(|_| "count must be an integer")?;
    if !(1..=MAX_PARTICLES).contains(&count) {
        return Err("count must be 1..32000");
    }
    Ok(count)
}

// Wasmは1つのブラウザページの中だけで利用。Rustがメモリを所有します。
// JSは次のgenerateを呼ぶまでの間だけFloat32Arrayで借りて読み取ります。
static BUFFER: Mutex<Vec<f32>> = Mutex::new(Vec::new());

#[unsafe(no_mangle)]
pub extern "C" fn galaxy_generate(count: u32, seed: u32) -> u32 {
    let mut buffer = BUFFER.lock().unwrap_or_else(|e| e.into_inner());
    *buffer = galaxy(count as usize, seed);
    (buffer.len() / STRIDE) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn cosmic_generate(mode: u32, count: u32, seed: u32) -> u32 {
    let mut buffer = BUFFER.lock().unwrap_or_else(|e| e.into_inner());
    *buffer = cloud(mode, count as usize, seed);
    (buffer.len() / STRIDE) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn galaxy_ptr() -> *const f32 {
    BUFFER.lock().unwrap_or_else(|e| e.into_inner()).as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn galaxy_len() -> u32 {
    BUFFER.lock().unwrap_or_else(|e| e.into_inner()).len() as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn same_seed_is_reproducible() {
        assert_eq!(galaxy(100, 42), galaxy(100, 42));
    }
    #[test]
    fn different_seed_changes_shape() {
        assert_ne!(galaxy(100, 42), galaxy(100, 43));
    }
    #[test]
    fn all_points_are_finite_and_bounded() {
        let g = galaxy(MAX_PARTICLES, 7);
        assert_eq!(g.len(), MAX_PARTICLES * STRIDE);
        for p in g.as_chunks::<STRIDE>().0 {
            assert!(p.iter().all(|v| v.is_finite()));
            assert!(p[0].abs() < 1.1 && p[1].abs() < 1.1 && p[2].abs() < 0.2);
            assert!((0.35..=1.0).contains(&p[3]));
        }
    }
    #[test]
    fn large_request_is_clamped_without_allocating_it() {
        assert_eq!(galaxy(usize::MAX, 1).len(), MAX_PARTICLES * STRIDE);
    }
    #[test]
    fn zero_points_is_empty() {
        assert!(galaxy(0, 1).is_empty());
    }
    #[test]
    fn zero_seed_remains_useful() {
        assert!(galaxy(20, 0).windows(4).any(|p| p[0] != p[1]));
    }
    #[test]
    fn count_boundaries() {
        assert_eq!(requested_count("1"), Ok(1));
        assert_eq!(requested_count("32000"), Ok(32000));
        assert!(requested_count("32001").is_err());
    }
    #[test]
    fn invalid_count_does_not_become_zero() {
        for s in ["0", "-1", "x", "1.2", "9999999999999999999999999999"] {
            assert!(requested_count(s).is_err());
        }
    }
    #[test]
    fn cloud_modes_are_bounded_finite_and_reproducible() {
        for mode in [1, 2, 3, u32::MAX] {
            let a = cloud(mode, MAX_PARTICLES, 42);
            assert_eq!(a, cloud(mode, MAX_PARTICLES, 42));
            assert_eq!(a.len(), MAX_PARTICLES * STRIDE);
            assert!(a.iter().all(|x| x.is_finite()));
            assert!(a.iter().all(|x| x.abs() <= 15.1));
        }
    }
    #[test]
    fn accretion_disk_preserves_central_hole() {
        for p in cloud(1, 1000, 7).as_chunks::<STRIDE>().0 {
            let r = (p[0] * p[0] + p[1] * p[1]).sqrt();
            assert!((0.234..1.086).contains(&r));
            assert!(p[2].abs() < 0.019);
        }
        assert!(cloud(1, 0, 1).is_empty());
    }
}
