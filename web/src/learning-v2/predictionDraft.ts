import type { Question } from "./types";

export const predictionOutputLimit = 4096;

export function predictionInput(question: Question, content = "") {
  const { answer } = question;
  const base = { selected: [] as string[], text: "", order: answer.orderItems.map(item => item.id).reverse() };
  if (!content || content.length > predictionOutputLimit || question.writingRequired) return base;
  if (answer.mode === "output" || answer.mode === "trace") return { ...base, text: content };
  try {
    const ids: unknown = JSON.parse(content);
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
  if (mode === "output" || mode === "trace") return input.text;
  if (mode === "order") {
    const initial = question.answer.orderItems;
    return input.order.every((id, i) => id === initial[initial.length - i - 1]?.id)
      ? "" : JSON.stringify(input.order);
  }
  return input.selected.length ? JSON.stringify(input.selected) : "";
}
