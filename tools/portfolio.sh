#!/bin/zsh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
case "$ROOT" in *'/['*) print -u2 'Bracket-prefixed private location refused'; exit 1;; esac
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.cargo/bin:$HOME/opt/apache-maven-3.9.11/bin:/opt/homebrew/bin:$PATH"
export CARGO_BUILD_JOBS=2
export RAYON_NUM_THREADS=2
export UV_THREADPOOL_SIZE=2
cd "$ROOT"
JAVA_HOME="$(/usr/libexec/java_home -v 21)"
case "${1:-help}" in
  web) exec npm --prefix web run dev ;;
  rust) exec cargo run --offline -j 2 --manifest-path backend/rust/Cargo.toml -p cosmic-api ;;
  test-rust) exec cargo test --offline -j 2 --manifest-path backend/rust/Cargo.toml -- --test-threads=2 ;;
  java|test-java)
    [[ ! -L .local && ! -L .local/java-bin ]] || { print -u2 'Linked runtime folder refused'; exit 1; }
    mkdir -p .local/java-bin
    "$JAVA_HOME/bin/javac" -J-XX:ActiveProcessorCount=2 -J-Xmx256m -encoding UTF-8 --release 21 -d .local/java-bin backend/java/src/cosmic/learning/LearningServer.java backend/java/test/cosmic/learning/LearningServerTest.java
    if [[ "$1" == java ]]; then
      exec "$JAVA_HOME/bin/java" -XX:ActiveProcessorCount=2 -Xmx256m -cp .local/java-bin cosmic.learning.LearningServer
    else
      exec "$JAVA_HOME/bin/java" -XX:ActiveProcessorCount=2 -Xmx128m -cp .local/java-bin cosmic.learning.LearningServerTest
    fi ;;
  test-java-browser) exec node tools/test-java-browser.mjs ;;
  java-browser) exec node tools/build-java-browser.mjs ;;
  problem-java-browser) exec node tools/build-problem-java.mjs ;;
  test-web) exec npm --prefix web test ;;
  build) exec npm --prefix web run build ;;
  wasm) exec node tools/build-wasm.mjs ;;
  verify)
    "$ROOT/tools/portfolio.sh" test-java
    "$ROOT/tools/portfolio.sh" test-java-browser
    "$ROOT/tools/portfolio.sh" test-rust
    "$ROOT/tools/portfolio.sh" test-web
    node tools/test-wasm.mjs
    node tools/check-build-inputs.mjs
    npm --prefix web run build ;;
  *) print 'Usage: ./tools/portfolio.sh web | java | rust | java-browser | problem-java-browser | test-java-browser | test-java | test-rust | test-web | wasm | build | verify' ;;
esac
