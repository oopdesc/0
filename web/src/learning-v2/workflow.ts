import { projectDraftKey } from "./progress";
export type WorkflowStage = {
  id: string;
  title: string;
  file: string;
  goal: string;
  template: string;
  example: string;
  checks: string[];
};
export type WorkflowCourse = {
  schema: "zero-workflow/1";
  title: string;
  brief: string;
  stages: WorkflowStage[];
};
export const workflowKey = (index: number) =>
  projectDraftKey("java:mission-workflow", "1", index);
export type WorkflowDraft = {
  schema: "zero-workflow-draft/1";
  text: string;
  checked: boolean[];
};
export function readWorkflowDraft(
  raw: string | undefined,
  stage: WorkflowStage,
): WorkflowDraft {
  if (!raw)
    return {
      schema: "zero-workflow-draft/1",
      text: stage.template,
      checked: stage.checks.map(() => false),
    };
  const value = JSON.parse(raw);
  if (
    value?.schema !== "zero-workflow-draft/1" ||
    typeof value.text !== "string" ||
    new TextEncoder().encode(value.text).byteLength > 48000 ||
    !Array.isArray(value.checked) ||
    value.checked.length !== stage.checks.length ||
    value.checked.some((flag: unknown) => typeof flag !== "boolean")
  )
    throw Error(
      "この工程の保存形式を確認できません。バックアップ画面で元の記録を保管してください。",
    );
  return value;
}
export function editWorkflowDraft(
  draft: WorkflowDraft,
  text: string,
): WorkflowDraft {
  return {
    ...draft,
    text,
    checked:
      text === draft.text ? draft.checked : draft.checked.map(() => false),
  };
}
export function validateWorkflow(value: unknown): WorkflowCourse {
  const c = value as WorkflowCourse;
  if (
    !c ||
    c.schema !== "zero-workflow/1" ||
    typeof c.title !== "string" ||
    typeof c.brief !== "string" ||
    !Array.isArray(c.stages) ||
    c.stages.length !== 8 ||
    new Set(c.stages.map((s) => s.id)).size !== 8
  )
    throw Error("実務教材の形式を確認できません。");
  for (const stage of c.stages)
    if (
      !stage ||
      !/^[a-z-]+$/.test(stage.id) ||
      !/^[0-9]{2}-[a-z-]+\.md$/.test(stage.file) ||
      !["title", "goal", "template", "example"].every(
        (key) => typeof stage[key as keyof WorkflowStage] === "string",
      ) ||
      !Array.isArray(stage.checks) ||
      stage.checks.length !== 3 ||
      stage.checks.some((s) => typeof s !== "string")
    )
      throw Error("工程の内容を確認できません。");
  return c;
}
