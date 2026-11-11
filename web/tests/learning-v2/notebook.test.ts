import assert from "node:assert/strict";
import test from "node:test";
import { notebookItems } from "../../src/learning-v2/notebook";
import {
  emptyProgress,
  exportProgress,
  importProgress,
  recordKey,
  recordPrediction,
  saveDraft,
  saveLearningNote,
  questionNotes,
  STORAGE_KEY,
} from "../../src/learning-v2/progress";
import {
  exportLearningBackup,
  restoreLearningBackup,
} from "../../src/learning-v2/learningBackup";
import type { StudyIndex } from "../../src/learning-v2/studyPlanner";

const now = Date.now() - 10000;
const key = recordKey("java:q0001", "1", "prediction");
const index: StudyIndex = {
  schema: "zero-study-index/1",
  concepts: {},
  items: [
    {
      id: "java:q0001",
      language: "java",
      title: "表示",
      version: "1",
      level: "beginner",
      writing: false,
      unit: 0,
      order: 1,
      concepts: [],
      prerequisites: [],
    },
  ],
};

test("notes survive old-format imports, keep answer drafts independent, and preserve the latest deletion", () => {
  const old = saveLearningNote(
    emptyProgress(),
    key,
    { content: "古いメモ", bookmarked: true },
    now - 3,
  );
  const edited = saveLearningNote(old, key, { content: "新しいメモ" }, now - 2);
  const withDraft = saveDraft(edited, key, "B", now - 1);
  const importedOldFormat = importProgress(
    exportProgress(emptyProgress()),
    withDraft,
  );
  assert.ok(importedOldFormat.ok);
  assert.equal(importedOldFormat.state.notes?.[key].content, "新しいメモ");
  assert.equal(importedOldFormat.state.drafts[key].content, "B");
  const cleared = saveLearningNote(
    withDraft,
    key,
    { content: "", bookmarked: false },
    now,
  );
  const restored = importProgress(exportProgress(old), cleared);
  assert.ok(restored.ok);
  assert.equal(restored.state.notes?.[key].content, "");
  assert.equal(
    notebookItems(index, restored.state, now)[0].note?.bookmarked,
    false,
  );
});

test("invalid or oversized imported notes fail without replacing existing records", () => {
  const saved = saveLearningNote(
    emptyProgress(),
    key,
    { content: "残すメモ" },
    now,
  );
  const invalid = {
    ...emptyProgress(),
    notes: {
      [key]: { content: "x".repeat(2001), bookmarked: false, updatedAt: now },
    },
  };
  assert.equal(importProgress(JSON.stringify(invalid), saved).ok, false);
  invalid.notes[key].content = "text";
  invalid.notes["invalid-key"] = invalid.notes[key];
  assert.equal(importProgress(JSON.stringify(invalid), saved).ok, false);
  assert.equal(saved.notes?.[key].content, "残すメモ");
});

test("the notebook follows the last result and retains bookmarks across content versions", () => {
  const wrong = recordPrediction(emptyProgress(), key, false, now - 2);
  assert.equal(notebookItems(index, wrong, now)[0].weak, true);
  const corrected = recordPrediction(wrong, key, true, now - 1);
  // Re-answering on the same day is assisted and remains a review candidate.
  assert.equal(notebookItems(index, corrected, now)[0].weak, true);
  const otherVersionKey = recordKey("java:q0001", "0", "prediction");
  const saved = saveLearningNote(
    corrected,
    otherVersionKey,
    { bookmarked: true, content: "規則を思い出す" },
    now,
  );
  assert.equal(notebookItems(index, saved, now)[0].note?.bookmarked, true);
  const newer = saveLearningNote(
    saved,
    key,
    { content: "", bookmarked: false },
    now + 1,
  );
  assert.equal(questionNotes(newer).get("java:q0001")?.content, "");
  const sameTimeUpdate = saveLearningNote(saved, key, { bookmarked: false, content: "" }, now);
  assert.equal(questionNotes(sameTimeUpdate).get("java:q0001")?.content, "");
});

test("combined backup restores notes and bookmarks with practice records", () => {
  const saved = saveLearningNote(
    emptyProgress(),
    key,
    { content: "値と参照の違い", bookmarked: true },
    now,
  );
  const source = new Map([[STORAGE_KEY, exportProgress(saved)]]);
  const memory = (values: Map<string, string>) => ({
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  });
  const raw = exportLearningBackup(memory(source));
  const destination = new Map<string, string>();
  const result = restoreLearningBackup(memory(destination), raw);
  assert.equal(result.counts.notes, 1);
  const restored = JSON.parse(destination.get(STORAGE_KEY)!);
  assert.deepEqual(restored.notes[key], saved.notes![key]);
});
