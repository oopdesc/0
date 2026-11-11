import { readFileSync, writeFileSync } from "node:fs";
const paths = [
  "pom.xml",
  "README.md",
  "SOLUTION.md",
  "src/main/java/zero/jpa/Author.java",
  "src/main/java/zero/jpa/Book.java",
  "src/main/java/zero/jpa/BookQueries.java",
  "src/test/java/zero/jpa/WorkshopTest.java",
];
const files = paths.map((path) => ({
  path,
  content: readFileSync(
    new URL("../practical/jpa/" + path, import.meta.url),
    "utf8",
  ),
}));
writeFileSync(
  new URL("../public/learning-v2/jpa-workshop.json", import.meta.url),
  JSON.stringify({ schema: "zero-jpa-workshop/1", files }) + "\n",
);
console.log(
  `Prepared ${files.length} explicit JPA source files; dependencies and build output excluded.`,
);
