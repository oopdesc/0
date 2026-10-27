// GENERATED glue. C-ABI surface for the browser (no wasm-bindgen dependency).
static mut OUT: [u8; OUT_CAP] = [0u8; OUT_CAP];
static mut OUT_LEN: usize = 0;
const OUT_CAP: usize = 8192;

fn store(s: &str) -> *mut u8 {
  let bytes = s.as_bytes();
  let n = bytes.len().min(OUT_CAP - 1);
  unsafe {
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), OUT.as_mut_ptr(), n);
    OUT[n] = 0;
    OUT_LEN = n;
    OUT.as_mut_ptr()
  }
}

#[no_mangle]
pub extern "C" fn problems_count() -> u32 {
  crate::problems::problem_count()
}

#[no_mangle]
pub extern "C" fn problems_run(index: u32) -> *mut u8 {
  store(&crate::problems::run_problem(index))
}

#[no_mangle]
pub extern "C" fn problems_len() -> usize {
  unsafe { OUT_LEN }
}
