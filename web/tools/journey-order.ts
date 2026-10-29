import type { CountedQuestion } from "./question-identity";
/** Stable topological ordering, with first-teaching questions preceding their consumers. */
export function buildJourneyOrder(groups: CountedQuestion[][]) {
  const introduces = new Map<string, number>();
  groups.forEach((group, i) =>
    group.forEach((q) =>
      q.introduces?.forEach((id) => {
        if (!introduces.has(id)) introduces.set(id, i);
      }),
    ),
  );
  const following = groups.map(() => new Set<number>()),
    degree = groups.map(() => 0);
  groups.forEach((group, i) =>
    group.forEach((q) =>
      q.prerequisites?.forEach((id) => {
        const before = introduces.get(id);
        if (before !== undefined && before !== i && !following[before].has(i)) {
          following[before].add(i);
          degree[i]++;
        }
      }),
    ),
  );
  const level = { beginner: 0, intermediate: 1, advanced: 2 };
  const priority = (i: number) => {
    const q = groups[i][0];
    return (
      level[q.level ?? "beginner"] * 1e8 +
      (q.language === "rust" ? 1e7 : 0) +
      (q.source === "normal"
        ? (q.courseRank ?? i)
        : q.source === "exam"
          ? 9e6
          : 5e6 + i)
    );
  };
  const ready = degree.flatMap((d, i) => (d === 0 ? [i] : [])),
    order: number[] = [];
  while (ready.length) {
    ready.sort((a, b) => priority(a) - priority(b) || a - b);
    const i = ready.shift()!;
    order.push(i);
    following[i].forEach((j) => {
      if (--degree[j] === 0) ready.push(j);
    });
  }
  if (order.length !== groups.length)
    throw Error("カリキュラムの前提に循環があります。順序を確認してください。");
  return order;
}
