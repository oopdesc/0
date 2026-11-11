import assert from "node:assert/strict";
import test from "node:test";
import { indentCode } from "../../src/learning-v2/codeEditing";

test("indenting a selection ending at a newline leaves the next line unchanged", () => {
  const source = "first\nsecond\nthird";
  const edited = indentCode(source, 0, 13);
  assert.equal(edited.code, "    first\n    second\nthird");
  assert.equal(edited.start, 4);
  assert.equal(edited.end, 21);
  assert.equal(edited.code.slice(edited.end), "third");
});

test("outdent handles spaces, a tab and a cursor inside indentation", () => {
  assert.deepEqual(indentCode("  line", 1, 1, true), {
    code: "line",
    start: 0,
    end: 0,
  });
  assert.equal(
    indentCode("\tfirst\n   second", 0, 16, true).code,
    "first\nsecond",
  );
  assert.deepEqual(indentCode("line", 0, 0, true), {
    code: "line",
    start: 0,
    end: 0,
  });
});

test("empty files and a cursor at the first newline retain a valid selection", () => {
  assert.deepEqual(indentCode("", 0, 0), { code: "    ", start: 4, end: 4 });
  assert.equal(indentCode("\nnext", 0, 0).code, "    \nnext");
  const edited = indentCode("a\nb", 2, 2);
  assert.equal(edited.code, "a\n    b");
  assert.equal(edited.start, 6);
});
