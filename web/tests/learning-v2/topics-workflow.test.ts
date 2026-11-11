import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { studyTopicGroups, inStudyTopic } from "../../src/learning-v2/topics";
import { validateStudyIndex, planStudy } from "../../src/learning-v2/studyPlanner";
import { parseStudyRound, readStudyFilter, todayHref } from "../../src/learning-v2/studyRound";
import { emptyProgress, saveDraft, exportProgress, importProgress } from "../../src/learning-v2/progress";
import { editWorkflowDraft, readWorkflowDraft, validateWorkflow, workflowKey } from "../../src/learning-v2/workflow";
const read = (file: string) => JSON.parse(readFileSync(new URL("../../public/learning-v2/" + file, import.meta.url), "utf8"));
const index = validateStudyIndex(read("study-index.json"));

test("every named topic has real questions and a collection plan excludes Stream-only concepts", () => {
  for (const topic of studyTopicGroups) {
    const selected = index.items.filter(item => inStudyTopic(topic, item));
    assert.ok(selected.length > 0, topic.id);
    assert.ok(selected.every(item => item.language === topic.language));
    const plan = planStudy(index, emptyProgress(), { language: topic.language, level: "all", kind: "all", limit: 5, includeNew: true, topic: topic.id });
    assert.ok(plan.length > 0 && plan.every(entry => inStudyTopic(topic, entry.item)));
  }
  const collections = studyTopicGroups.find(topic => topic.id === "java-collections")!;
  assert.equal(inStudyTopic(collections, { language: "java", concepts: ["java:stream-map"] }), false);
});

test("a topic survives preferences and a round backup", () => {
  const filter = readStudyFilter(new URLSearchParams("topic=java-streams&lang=java&limit=5"));
  assert.equal(filter.topic, "java-streams");
  assert.equal(readStudyFilter(new URLSearchParams(todayHref(filter).split("?")[1])).topic, filter.topic);
  const round = parseStudyRound(JSON.stringify({ token: "round-123456", startedAt: Date.now(), ids: ["java:q0001"], outcomes: [], filter }));
  assert.equal(round?.filter.topic, "java-streams");
});

test("each workflow stage starts independently and editing invalidates self-review", () => {
  const course = validateWorkflow(read("workflow.json"));
  assert.equal(course.stages.length, 8);
  for (const [i, stage] of course.stages.entries()) {
    const draft = readWorkflowDraft(undefined, stage);
    assert.ok(draft.text.includes("#"));
    const checked = { ...draft, checked: [true, true, true] };
    const edited = editWorkflowDraft(checked, draft.text + "自分の記入");
    assert.deepEqual(edited.checked, [false, false, false]);
    const saved = saveDraft(emptyProgress(), workflowKey(i), JSON.stringify(edited));
    const imported = importProgress(exportProgress(saved), emptyProgress());
    assert.ok(imported.ok);
    assert.equal(readWorkflowDraft(imported.state.drafts[workflowKey(i)].content, stage).text, edited.text);
    assert.throws(() => readWorkflowDraft('{"schema":"wrong"}', stage));
  }
});
