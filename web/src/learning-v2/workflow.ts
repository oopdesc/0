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
// Draft keys predate named stages. Keep the original order stable so an update
// cannot attach a learner's saved design to a different stage.
export const workflowStageIds = [
  "requirements",
  "basic",
  "detail",
  "implementation",
  "unit",
  "integration",
  "system",
  "release",
] as const;
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
    c.stages.some((s, i) => !s || s.id !== workflowStageIds[i])
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

export function workflowStatus(
  course: WorkflowCourse,
  drafts: Record<string, { content: string }>,
) {
  validateWorkflow(course);
  return course.stages.map((stage, index) => {
    const draft = readWorkflowDraft(drafts[workflowKey(index)]?.content, stage);
    const written = !!draft.text.trim() && draft.text !== stage.template;
    const checks = draft.checked.filter(Boolean).length;
    return {
      id: stage.id,
      written,
      checks,
      reviewed: written && checks === stage.checks.length,
    };
  });
}

export function workflowFiles(
  course: WorkflowCourse,
  drafts: Record<string, { content: string }>,
): Record<string, string> {
  validateWorkflow(course);
  const files: Record<string, string> = {};
  const status: string[] = [];
  const states = workflowStatus(course, drafts);
  course.stages.forEach((stage, index) => {
    const draft = readWorkflowDraft(drafts[workflowKey(index)]?.content, stage);
    files[stage.file] = draft.text;
    status.push(
      `- ${stage.title}: ${states[index].written ? "自分の記入あり" : draft.text === stage.template ? "テンプレート（未編集）" : "未記入"} / 自己レビュー ${states[index].checks}/${stage.checks.length}`,
    );
  });
  files["README.md"] = [
    "# 実務の流れ・自分の成果物",
    "",
    course.title,
    "",
    course.brief,
    "",
    "## 記入状況",
    ...status,
    "",
    "テンプレートも含みます。自己レビューは自分のチェックであり、自動採点・実行結果・業務経験・リリース承認の証明ではありません。",
    "実コードで試験し、実際の結果と証跡を追記してください。会社の情報や個人情報を含む状態で公開しないでください。",
    "",
  ].join("\n");
  return files;
}
