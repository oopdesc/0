import test from "node:test";
import assert from "node:assert/strict";
import stats from "../src/generated/learning-stats.json";
import { buildLearningInventory } from "../tools/learning-inventory";
import {
  codeIdentity,
  groupQuestions,
  type CountedQuestion,
} from "../tools/question-identity";
const item = (
  key: string,
  other: Partial<CountedQuestion> = {},
): CountedQuestion => ({
  key,
  language: "java",
  source: "normal",
  prompt: "出力は？",
  code: "System.out.println(3);",
  answer: '["3"]',
  mode: "prediction",
  writing: false,
  aliases: [],
  options: ["3", "4"],
  predictive: true,
  ...other,
});
test("reposted origins and reformatted output questions are counted once, rather than once per view", () => {
  const normal = item("java:q0001"),
    exam = item("exam:q1", {
      source: "exam",
      aliases: ["java:q0001"],
      prompt: "試験で再掲",
    }),
    supp = item("academy:a", {
      source: "supplemental",
      prompt: "何が表示されますか",
      code: "public class Main { public static void main(String[] args) { /* note */ System.out.println(3); } }",
    });
  assert.equal(groupQuestions([normal, exam, supp]).length, 1);
  assert.equal(
    groupQuestions([
      normal,
      item("rust:q0001", { language: "rust", aliases: [normal.key] }),
    ]).length,
    2,
  );
  assert.throws(() => groupQuestions([normal, normal]), /Duplicate/);
});
test("same concepts, generic prompts, changed literal strings and different implementation contracts stay distinct", () => {
  assert.equal(
    groupQuestions([
      item("a", { code: "", predictive: false }),
      item("b", { code: "", options: ["5", "6"], predictive: false }),
    ]).length,
    2,
  );
  assert.equal(
    groupQuestions([
      item("a"),
      item("b", { code: "System.out.println(4);", answer: '["4"]' }),
    ]).length,
    2,
  );
  assert.notEqual(
    codeIdentity('println!("a b");'),
    codeIdentity('println!("ab");'),
  );
  assert.notEqual(
    codeIdentity('println!(r#"a // b"#);', "rust"),
    codeIdentity('println!(r#"ab"#);', "rust"),
  );
  assert.notEqual(codeIdentity("x >> 2"), codeIdentity("x > > 2"));
  assert.notEqual(
    codeIdentity("double x=1.2;"),
    codeIdentity("double x=1 . 2;"),
  );
  assert.notEqual(codeIdentity("x >>>= 2"), codeIdentity("x >> >= 2"));
  assert.equal(codeIdentity("1..=3", "rust"), codeIdentity("1 ..= 3", "rust"));
  assert.equal(
    groupQuestions([
      item("a", { writing: true, mode: "code", answer: "contract1" }),
      item("b", { writing: true, mode: "code", answer: "contract2" }),
    ]).length,
    2,
  );
  assert.equal(
    codeIdentity(
      "fn f<'a>(s: &'a str) { /* outer /* nested */ done */ s; }",
      "rust",
    ),
    codeIdentity("fn f<'a>(s: &'a str){s;}", "rust"),
  );
});
test("inventory is regenerated from every published bank, selected exam question and browser example", () => {
  const { groups, summary } = buildLearningInventory();
  assert.deepEqual(summary, stats.unique);
  assert.equal(summary.java + summary.rust, summary.total);
  assert.equal(
    summary.normal +
      summary.supplementalAdditional +
      summary.examAdditional +
      summary.legacyAdditional,
    summary.total,
  );
  assert.equal(groups.flat().length, summary.occurrences);
  assert.equal(
    new Set(groups.flat().map((q) => q.key)).size,
    summary.occurrences,
  );
  assert.equal(summary.occurrences - summary.removed, summary.total);
  const identity = new Map(
    groups.flatMap((g, i) => g.map((q) => [q.key, i] as const)),
  );
  for (const g of groups)
    for (const q of g)
      for (const alias of q.aliases)
        if (identity.has(alias))
          assert.equal(
            identity.get(alias),
            identity.get(q.key),
            "explicit repost must not add another question",
          );
  assert(
    summary.writing <= summary.total &&
      summary.examAdditional < summary.examOccurrences,
  );
});
