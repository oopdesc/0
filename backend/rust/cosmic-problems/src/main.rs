// Host-side verifier entry point. Reads a problem index and prints the result.
use std::io::Write;

fn main() {
  let args: Vec<String> = std::env::args().collect();
  let index: u32 = match args.get(1).and_then(|s| s.parse().ok()) {
    Some(i) => i,
    None => {
      eprintln!("usage: problems-verify <index>");
      std::process::exit(2);
    }
  };
  let out = cosmic_problems::run_problem(index);
  let _ = std::io::stdout().write_all(out.as_bytes());
}
