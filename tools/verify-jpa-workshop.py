"""Verify the seven explicit ORM exercise sources, in isolated scratch copies."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
source = root / "web/practical/jpa"
scratch = Path(tempfile.mkdtemp(prefix="zero-jpa-verify-"))
files = ["pom.xml", "README.md", "SOLUTION.md", "src/main/java/zero/jpa/Author.java", "src/main/java/zero/jpa/Book.java", "src/main/java/zero/jpa/BookQueries.java", "src/test/java/zero/jpa/WorkshopTest.java"]
for stage in ["starter", "solution"]:
    for name in files:
        dest = scratch / stage / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((source / name).read_bytes())
book = scratch / "solution/src/main/java/zero/jpa/Book.java"
book.write_text(book.read_text(encoding="utf-8").replace("    private long version;", "    @Version\n    private long version;"), encoding="utf-8")
queries = scratch / "solution/src/main/java/zero/jpa/BookQueries.java"
text = queries.read_text(encoding="utf-8")
text = text.replace("select b from Book b order by b.id", "select b from Book b join fetch b.author order by b.id")
text = text.replace('"select b from Book b where b.title = \'" + title + "\'"', '"select b from Book b where b.title = :title"')
text = text.replace("                .getResultList();", '                .setParameter("title", title).getResultList();')
text = text.replace("                tx.commit();\n", "")
queries.write_text(text, encoding="utf-8")
results = []
env = dict(os.environ)
env["MAVEN_OPTS"] = "-Xmx384m"
for stage in ["starter", "solution"]:
    with (scratch / (stage + ".log")).open("w", encoding="utf-8") as log:
        result = subprocess.run(["mvn", "-T", "2", "test"], cwd=scratch / stage, stdout=log, stderr=subprocess.STDOUT, env=env, timeout=180)
    report = ET.parse(scratch / stage / "target/surefire-reports/TEST-zero.jpa.WorkshopTest.xml").getroot()
    counts = {key: int(report.get(key)) for key in ["tests", "failures", "errors", "skipped"]}
    assert counts["tests"] == 8 and counts["errors"] == 0 and counts["skipped"] == 0
    assert counts["failures"] == (4 if stage == "starter" else 0)
    assert (result.returncode == 0) == (stage == "solution")
    failures = [case.get("name") for case in report.findall("testcase") if case.find("failure") is not None]
    results.append({"stage":stage, "exitCode":result.returncode, **counts, "failingTests":failures})
verification = {
    "verifiedAtJST": datetime.now(timezone(timedelta(hours=9))).isoformat(),
    "method": "Real Hibernate ORM 7.4.15.Final + isolated H2 memory databases; javac release17; Maven concurrency2; test fork1; pool2",
    "results": results,
    "sourceSha256": {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in files},
    "httpOrExternalDatabaseUsed": False,
}
(root / "docs/JPA_WORKSHOP_VERIFICATION_20261111.json").write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"allChecksPassed":True, "results":results, "logs":str(scratch)}, ensure_ascii=False))
