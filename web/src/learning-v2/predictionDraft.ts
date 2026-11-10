import type { Question } from "./types";

export const predictionOutputLimit = 4096;

export function recallOutput(question: Question): string[] | null {
  const { answer, evidence } = question;
  const run = evidence.compilerRun;
  if (question.writingRequired || answer.mode !== "choice" || answer.correctOptionIds.length !== 1 ||
      !/(出力|表示|何が印字)/u.test(question.prompt) ||
      !run || !["passed", "observed", "ok"].includes(run.status)) return null;
  const lines = run.stdout;
  if (!Array.isArray(lines) || lines.length > 8 || !lines.every(line => typeof line === "string") ||
      !lines.some(line => line.length > 0) || lines.join("\n").length > 240) return null;
  const option = answer.options.find(option => option.id === answer.correctOptionIds[0]);
  return option && (option.text === lines.join("\n") || option.text === lines.join("と")) ? lines : null;
}

export function predictionInput(question: Question, content = "") {
  const { answer } = question;
  const base = { selected: [] as string[], text: "", order: answer.orderItems.map(item => item.id).reverse(), typed: false };
  if (!content || content.length > 6 * predictionOutputLimit + 32 || question.writingRequired) return base;
  if (answer.mode === "output" || answer.mode === "trace") return content.length <= predictionOutputLimit ? { ...base, text: content } : base;
  try {
    const ids: unknown = JSON.parse(content);
    if (ids && typeof ids === "object" && "output" in ids && typeof ids.output === "string" &&
        ids.output.length <= predictionOutputLimit && recallOutput(question))
      return { ...base, text: ids.output, typed: true };
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return base;
    if (answer.mode === "order") {
      if (ids.length === base.order.length && ids.every(id => base.order.includes(id))) return { ...base, order: ids as string[] };
    } else if (answer.mode === "choice" || answer.mode === "multichoice") {
      if ((answer.mode !== "choice" || ids.length <= 1) && ids.every(id => answer.options.some(option => option.id === id)))
        return { ...base, selected: ids as string[] };
    }
  } catch { /* The stored value is not a valid draft for this question. */ }
  return base;
}

export function predictionContent(question: Question, input: ReturnType<typeof predictionInput>) {
  const { mode } = question.answer;
  if (input.typed) return input.text ? JSON.stringify({ output: input.text }) : "";
  if (mode === "output" || mode === "trace") return input.text;
  if (mode === "order") {
    const initial = question.answer.orderItems;
    return input.order.every((id, i) => id === initial[initial.length - i - 1]?.id)
      ? "" : JSON.stringify(input.order);
  }
  return input.selected.length ? JSON.stringify(input.selected) : "";
}
