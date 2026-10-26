;; ORRERY cosmos kernel.
;;
;; This WAT is a line-by-line translation of rust/src/lib.rs (the canonical,
;; human-maintained source). The authoring sandbox had no Rust toolchain, so the
;; committed .wasm is produced from THIS file by scripts/build-wasm.mjs (wabt).
;; Both files export exactly the same two functions with identical semantics;
;; src/tests/wasm.test.ts asserts the WASM output equals the TypeScript reference.
;;
;; Memory layout: one body = 8 x f32 (32 bytes), little-endian.
;;   0: x   1: y   2: vx   3: vy   4: mass   5: radius   6: flags   7: glow
;; flags: 0.0 = free mover, 1.0 = fixed attractor.
;; The first `na` bodies in the buffer are the attractors.

(module
  (memory (export "memory") 8)

  ;; Deterministic integer hash -> [0, 1). Mirrors hash01() in src/core/rng.ts.
  (func (export "hash01") (param $i i32) (param $seed i32) (result f32)
    (local $x i32)
    (local.set $x
      (i32.xor
        (i32.mul (i32.xor (local.get $i) (local.get $seed)) (i32.const 668265261))
        (i32.const -2048144789)))
    (local.set $x (i32.xor (local.get $x) (i32.shr_u (local.get $x) (i32.const 15))))
    (local.set $x (i32.mul (local.get $x) (i32.const 739982445)))
    (local.set $x (i32.xor (local.get $x) (i32.shr_u (local.get $x) (i32.const 12))))
    (f32.div (f32.convert_i32_u (local.get $x)) (f32.const 4294967296)))

  ;; One semi-implicit Euler step. Softened Newtonian attraction toward the
  ;; first `na` bodies. This is an EDUCATIONAL MODEL, not an n-body integrator
  ;; and not a physical observation.
  (func (export "step")
    (param $ptr i32) (param $count i32) (param $na i32)
    (param $g f32) (param $dt f32) (param $soft f32) (param $maxv f32)
    (local $i i32) (local $j i32) (local $bi i32) (local $bj i32)
    (local $x f32) (local $y f32) (local $vx f32) (local $vy f32)
    (local $ax f32) (local $ay f32) (local $dx f32) (local $dy f32)
    (local $r2 f32) (local $f f32) (local $soft2 f32)
    (local $sp2 f32) (local $scale f32) (local $maxv2 f32)

    (local.set $soft2 (f32.mul (local.get $soft) (local.get $soft)))
    (local.set $maxv2 (f32.mul (local.get $maxv) (local.get $maxv)))
    (local.set $i (i32.const 0))

    (block $done
      (loop $outer
        (br_if $done (i32.ge_s (local.get $i) (local.get $count)))
        (local.set $bi (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 32))))
        (if (f32.eq (f32.load offset=24 (local.get $bi)) (f32.const 0))
          (then
            (local.set $x (f32.load offset=0 (local.get $bi)))
            (local.set $y (f32.load offset=4 (local.get $bi)))
            (local.set $vx (f32.load offset=8 (local.get $bi)))
            (local.set $vy (f32.load offset=12 (local.get $bi)))
            (local.set $ax (f32.const 0))
            (local.set $ay (f32.const 0))
            (local.set $j (i32.const 0))
            (block $inner_done
              (loop $inner
                (br_if $inner_done (i32.ge_s (local.get $j) (local.get $na)))
                (local.set $bj (i32.add (local.get $ptr) (i32.mul (local.get $j) (i32.const 32))))
                (local.set $dx (f32.sub (f32.load offset=0 (local.get $bj)) (local.get $x)))
                (local.set $dy (f32.sub (f32.load offset=4 (local.get $bj)) (local.get $y)))
                (local.set $r2
                  (f32.add
                    (f32.add
                      (f32.mul (local.get $dx) (local.get $dx))
                      (f32.mul (local.get $dy) (local.get $dy)))
                    (local.get $soft2)))
                (local.set $f
                  (f32.div
                    (f32.mul (local.get $g) (f32.load offset=16 (local.get $bj)))
                    (f32.mul (local.get $r2) (f32.sqrt (local.get $r2)))))
                (local.set $ax (f32.add (local.get $ax) (f32.mul (local.get $dx) (local.get $f))))
                (local.set $ay (f32.add (local.get $ay) (f32.mul (local.get $dy) (local.get $f))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $inner)))
            (local.set $vx (f32.add (local.get $vx) (f32.mul (local.get $ax) (local.get $dt))))
            (local.set $vy (f32.add (local.get $vy) (f32.mul (local.get $ay) (local.get $dt))))
            (local.set $sp2 (f32.add (f32.mul (local.get $vx) (local.get $vx))
                                     (f32.mul (local.get $vy) (local.get $vy))))
            (if (f32.gt (local.get $sp2) (local.get $maxv2))
              (then
                (local.set $scale (f32.div (local.get $maxv) (f32.sqrt (local.get $sp2))))
                (local.set $vx (f32.mul (local.get $vx) (local.get $scale)))
                (local.set $vy (f32.mul (local.get $vy) (local.get $scale)))))
            (local.set $x (f32.add (local.get $x) (f32.mul (local.get $vx) (local.get $dt))))
            (local.set $y (f32.add (local.get $y) (f32.mul (local.get $vy) (local.get $dt))))
            (f32.store offset=0 (local.get $bi) (local.get $x))
            (f32.store offset=4 (local.get $bi) (local.get $y))
            (f32.store offset=8 (local.get $bi) (local.get $vx))
            (f32.store offset=12 (local.get $bi) (local.get $vy))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $outer))))

  ;; Number of f32 words per body. Kept as an export so the host can assert ABI.
  (func (export "stride") (result i32) (i32.const 8)))
