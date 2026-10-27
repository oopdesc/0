export * from './schema';
export * from './topics';
import { TOPIC_MAP } from './topics';

import type { Language, Problem } from './schema';
import { JAVA_CORE } from './javaCore';
import { JAVA_ADVANCED } from './javaAdvanced';
import { RUST_CORE } from './rustCore';
import { RUST_ADVANCED } from './rustAdvanced';
import { BRIDGE } from './bridge';

export const JAVA_PROBLEMS: Problem[] = [...JAVA_CORE, ...JAVA_ADVANCED];
export const RUST_PROBLEMS: Problem[] = [...RUST_CORE, ...RUST_ADVANCED];
export const BRIDGE_PROBLEMS: Problem[] = BRIDGE;

export const ALL_PROBLEMS: Problem[] = [
  ...JAVA_PROBLEMS,
  ...RUST_PROBLEMS,
  ...BRIDGE_PROBLEMS,
];

const BY_ID = new Map<string, Problem>();
for (const p of ALL_PROBLEMS) BY_ID.set(p.id, p);

export function getProblem(id: string): Problem | undefined {
  return BY_ID.get(id);
}

export function problemsForTopic(topicId: string): Problem[] {
  return ALL_PROBLEMS.filter((p) => p.topic === topicId);
}

export function problemsForLanguage(language: Language | 'bridge'): Problem[] {
  if (language === 'bridge') return BRIDGE_PROBLEMS;
  return language === 'java' ? JAVA_PROBLEMS : RUST_PROBLEMS;
}

export const JAVA_COUNT = JAVA_PROBLEMS.length;
export const RUST_COUNT = RUST_PROBLEMS.length;
export const BRIDGE_COUNT = BRIDGE_PROBLEMS.length;
export const TOTAL_COUNT = ALL_PROBLEMS.length;

/** Ordering used by "next problem" and by the curriculum pages. */
export function orderedProblems(language: Language | 'bridge'): Problem[] {
  return problemsForLanguage(language).sort((a, b) => {
    const ta = TOPIC_MAP[a.topic]?.order ?? 99;
    const tb = TOPIC_MAP[b.topic]?.order ?? 99;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

export type Filter = {
  language?: Language | 'bridge' | 'all';
  topic?: string;
  level?: 1 | 2 | 3;
  query?: string;
};

export function filterProblems(filter: Filter): Problem[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  return ALL_PROBLEMS.filter((p) => {
    if (filter.language && filter.language !== 'all' && p.topic.startsWith('bridge-')) {
      if (filter.language !== 'bridge') return false;
    } else if (filter.language && filter.language !== 'all') {
      const want = filter.language;
      if (want === 'bridge') return p.topic.startsWith('bridge-');
      if (p.language !== want) return false;
    }
    if (filter.topic && p.topic !== filter.topic) return false;
    if (filter.level && p.level !== filter.level) return false;
    if (q) {
      const hay = `${p.prompt} ${p.explanation} ${p.misconception} ${p.oneLinePatch} ${p.topic}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Number of problems that carry a compiler/JVM verified expectation. */
export function verifiedProblems(): Problem[] {
  return ALL_PROBLEMS.filter(
    (p) => p.execution !== 'reading' && !!p.expected,
  );
}

export function topicStats() {
  const out = new Map<string, { count: number; java: number; rust: number }>();
  for (const p of ALL_PROBLEMS) {
    const cur = out.get(p.topic) ?? { count: 0, java: 0, rust: 0 };
    cur.count++;
    if (p.language === 'java') cur.java++;
    if (p.language === 'rust') cur.rust++;
    out.set(p.topic, cur);
  }
  return out;
}
