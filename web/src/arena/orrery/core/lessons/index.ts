import type { Challenge, ChallengeKind, Lesson, Track } from './schema';
import { SUPPORT_LEVEL } from './schema';
import { JAVA_LESSONS } from './java';
import { RUST_LESSONS } from './rust';
import { BRIDGE_LESSONS } from './bridge';

export * from './schema';
export { JAVA_LESSONS, RUST_LESSONS, BRIDGE_LESSONS };

export const ALL_LESSONS: Lesson[] = [...JAVA_LESSONS, ...RUST_LESSONS, ...BRIDGE_LESSONS];

export function getLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function lessonsForTrack(track: Track): Lesson[] {
  return ALL_LESSONS.filter((l) => l.track === track);
}

export function allChallenges(): Challenge[] {
  return ALL_LESSONS.flatMap((l) => l.challenges);
}

export function findChallenge(id: string): { lesson: Lesson; challenge: Challenge; index: number } | null {
  for (const lesson of ALL_LESSONS) {
    const index = lesson.challenges.findIndex((c) => c.id === id);
    if (index >= 0) return { lesson, challenge: lesson.challenges[index]!, index };
  }
  return null;
}

/** First challenge whose support level is at least `level` (skip-ahead). */
export function skipToLevel(lesson: Lesson, level: number): number {
  const idx = lesson.challenges.findIndex((c) => SUPPORT_LEVEL[c.kind] >= level);
  return idx >= 0 ? idx : lesson.challenges.length - 1;
}

export function supportLevel(kind: ChallengeKind): number {
  return SUPPORT_LEVEL[kind];
}

export function challengesForConcept(conceptId: string): Challenge[] {
  return allChallenges().filter((c) => c.concept === conceptId);
}

/** Deterministic curriculum order used by "next challenge" navigation. */
export function nextChallengeId(currentId: string): string | null {
  const flat = allChallenges();
  const i = flat.findIndex((c) => c.id === currentId);
  return i >= 0 && i + 1 < flat.length ? flat[i + 1]!.id : null;
}

export const TOTAL_CHALLENGES = allChallenges().length;
