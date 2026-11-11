"""Verify only the six explicit public exercise inputs, with real local compilers."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone, timedelta

root = Path(__file__).resolve().parent.parent
source = root / "web/practical"
scratch = Path(tempfile.mkdtemp(prefix="zero-workplace-verify-"))
checks = []


def run(name, args, expect_success=True):
    result = subprocess.run(args, text=True, capture_output=True, timeout=60)
    (scratch / (name + ".log")).write_text(result.stdout + result.stderr, encoding="utf-8")
    ok = (result.returncode == 0) == expect_success
    checks.append({"name": name, "exitCode": result.returncode, "expectedSuccess": expect_success, "matchedExpectation": ok})
    if not ok:
        raise RuntimeError(f"{name} did not match expectation; logs: {scratch}")
    return result.stdout + result.stderr


solution = (source / "SOLUTION.md").read_text(encoding="utf-8")
java_answer = re.search(r"```java\n(.*?)```", solution, re.S).group(1)
rust_answer = re.search(r"```rust\n(.*?)```", solution, re.S).group(1)
java = (source / "java/BookService.java").read_text(encoding="utf-8")
rust = (source / "rust/src/lib.rs").read_text(encoding="utf-8")
(scratch / "WorkplaceTest.java").write_text((source / "java/WorkplaceTest.java").read_text(encoding="utf-8"), encoding="utf-8")
(scratch / "BookService.java").write_text(java, encoding="utf-8")
(scratch / "lib.rs").write_text(rust, encoding="utf-8")
javac = ["javac", "-encoding", "UTF-8", "--release", "17", "-d"]
java_files = [str(scratch / "BookService.java"), str(scratch / "WorkplaceTest.java")]
run("java-starter-compile", javac + [str(scratch / "starter-java")] + java_files)
run("java-starter-tests", ["java", "-cp", str(scratch / "starter-java"), "WorkplaceTest"], False)
run("rust-starter-compile", ["rustc", "--edition=2021", "--test", str(scratch / "lib.rs"), "-o", str(scratch / "rust-starter")])
run("rust-starter-tests", [str(scratch / "rust-starter"), "--test-threads=2"], False)

# Replace the two explicitly identified TODO functions, leaving all tests unchanged.
start = java.index("    public static int validId(")
end = java.index("    public Optional<Book> find(String raw)", start)
java = java[:start] + java_answer[:java_answer.index("\npublic Update rename")] + "\n" + java[end:]
start = java.index("    public Update rename(")
java = java[:start] + java_answer[java_answer.index("public Update rename"):] + "\n}\n"
start = rust.index("pub fn valid_id(")
end = rust.index("pub fn find(", start)
rust = rust[:start] + rust_answer[:rust_answer.index("\npub fn rename")] + "\n" + rust[end:]
start = rust.index("pub fn rename(")
end = rust.index("\n#[cfg(test)]", start)
rust = rust[:start] + rust_answer[rust_answer.index("pub fn rename"):] + "\n" + rust[end:]
(scratch / "BookService.java").write_text(java, encoding="utf-8")
(scratch / "lib.rs").write_text(rust, encoding="utf-8")
run("java-solution-compile", javac + [str(scratch / "solution-java")] + java_files)
jout = run("java-solution-tests", ["java", "-cp", str(scratch / "solution-java"), "WorkplaceTest"])
run("rust-solution-compile", ["rustc", "--edition=2021", "--test", str(scratch / "lib.rs"), "-o", str(scratch / "rust-solution")])
rout = run("rust-solution-tests", [str(scratch / "rust-solution"), "--test-threads=2"])
assert "8 passed, 0 failed" in jout
assert "7 passed; 0 failed" in rout
inputs = ["README-START.md", "SOLUTION.md", "java/BookService.java", "java/WorkplaceTest.java", "rust/Cargo.toml", "rust/src/lib.rs"]
report = {
    "verifiedAtJST": datetime.now(timezone(timedelta(hours=9))).isoformat(),
    "method": "real local javac/java (--release 17) and rustc --test; sequential compilers, test threads <=2",
    "compilerVersions": {"javac": subprocess.run(["javac", "-version"], capture_output=True, text=True).stdout.strip(), "rustc": subprocess.run(["rustc", "--version"], capture_output=True, text=True).stdout.strip()},
    "checks": checks,
    "solutionTests": {"javaPassed": 8, "rustPassed": 7},
    "sourceSha256": {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in inputs},
    "httpOrDatabaseTested": False,
}
(root / "docs/PRACTICAL_COMPILER_VERIFICATION_20261111.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"allChecksPassed": True, "java": "8/8", "rust": "7/7", "logs": str(scratch)}, ensure_ascii=False))
