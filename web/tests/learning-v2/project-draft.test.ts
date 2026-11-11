import test from "node:test";
import assert from "node:assert/strict";
import { persistProjectDraft } from "../../src/learning-v2/projectDraft";
import {
  loadProgress,
  projectDraftKey,
  STORAGE_KEY,
} from "../../src/learning-v2/progress";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
test("a stale project editor cannot replace another tab's newer code; unrelated file edits survive", () => {
  const storage = memory();
  const a = projectDraftKey("java:mission-books-id", "1", 0);
  const b = projectDraftKey("rust:mission-book-title", "1", 0);
  assert.equal(persistProjectDraft(storage, a, "first", undefined).ok, true);
  assert.equal(
    persistProjectDraft(storage, b, "Rust draft", undefined).ok,
    true,
  );
  assert.equal(
    persistProjectDraft(storage, a, "new version", "first").ok,
    true,
  );
  const before = storage.data.get(STORAGE_KEY);
  const conflict = persistProjectDraft(storage, a, "stale version", "first");
  assert.equal(conflict.ok, false);
  assert.equal(storage.data.get(STORAGE_KEY), before);
  const state = loadProgress(storage).state;
  assert.equal(state.drafts[a].content, "new version");
  assert.equal(state.drafts[b].content, "Rust draft");
});
test("corrupt storage, oversized drafts and quota errors never report a successful project save", () => {
  const key = projectDraftKey("java:mission-books-id", "1", 0);
  const storage = memory();
  storage.data.set(STORAGE_KEY, "invalid JSON");
  assert.equal(persistProjectDraft(storage, key, "new", undefined).ok, false);
  assert.equal(storage.data.get(STORAGE_KEY), "invalid JSON");
  const clean = memory();
  assert.equal(
    persistProjectDraft(clean, key, "あ".repeat(22000), undefined).ok,
    false,
  );
  assert.equal(clean.data.size, 0);
  assert.equal(
    persistProjectDraft(
      {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("Full", "QuotaExceededError");
        },
      },
      key,
      "x",
      undefined,
    ).ok,
    false,
  );
});
