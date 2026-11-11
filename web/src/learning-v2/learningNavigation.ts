import type { Concept, Lang, Question } from "./types";

/** Keep the return destination inside a known learning page and bound nested links. */
export function learningReturn(value: string | null): string | null {
  if (
    !value ||
    value.length > 1200 ||
    !value.startsWith("/learn?") ||
    /[\u0000-\u001f]/u.test(value)
  )
    return null;
  const url = new URL(value, "https://learning.invalid");
  if (
    url.pathname !== "/learn" ||
    !["drill", "writing", "journey", "notebook", "today"].includes(
      url.searchParams.get("section") ?? "",
    )
  )
    return null;
  url.searchParams.delete("returnTo");
  return url.pathname + url.search;
}

export function prerequisiteQuestion(
  concept: Concept,
  currentId: string,
  lang: Lang,
) {
  return [...concept.introducedBy, ...concept.problemIds].find(
    (id) =>
      id !== currentId && new RegExp("^" + lang + ":q[0-9]{4,8}$").test(id),
  );
}

export function questionConcepts(question: Question, concepts: Concept[]) {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  return question.prerequisiteConceptIds.flatMap((id) => {
    const concept = byId.get(id);
    return concept ? [concept] : [];
  });
}
