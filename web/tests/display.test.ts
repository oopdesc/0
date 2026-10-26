import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTheme, DISPLAY_KEY } from "../src/display";
import { STORAGE_KEY } from "../src/state";
test("初期表示はOSに依存せずライト、不正な保存値もライト", () => {
  for (const raw of [
    null,
    "",
    "dark",
    "{}",
    '{"schema":2,"theme":"dark"}',
    '{"schema":1,"theme":null}',
    "x".repeat(130),
  ])
    assert.equal(parseTheme(raw), "light");
  assert.equal(parseTheme('{"schema":1,"theme":"dark"}'), "dark");
  assert.equal(parseTheme('{"schema":1,"theme":"light"}'), "light");
  assert.notEqual(DISPLAY_KEY, STORAGE_KEY);
});
