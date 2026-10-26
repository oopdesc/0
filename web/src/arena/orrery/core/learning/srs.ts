/**
 * Spaced retrieval (SM-2-lite). Entirely local, deterministic, no account.
 * Grades: 0 = もう一度, 1 = 苦手, 2 = できた.
 */
export interface ReviewCard {
  id: string;
  due: number;
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
  lastReviewed: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function newCard(id: string, now = Date.now()): ReviewCard {
  return { id, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, lastReviewed: 0 };
}

export function isDue(card: ReviewCard, now = Date.now()): boolean {
  return card.due <= now;
}

export function schedule(card: ReviewCard, grade: 0 | 1 | 2, now = Date.now()): ReviewCard {
  const ease = Math.max(1.3, Math.min(2.8, card.ease + (grade === 2 ? 0.1 : grade === 1 ? -0.14 : -0.25)));
  let interval: number;
  if (grade === 0) interval = 0;
  else if (card.reps === 0) interval = grade === 2 ? 1 : 0.5;
  else interval = Math.max(0.5, card.interval * ease * (grade === 1 ? 0.6 : 1));
  if (grade === 0) interval = 10 / (24 * 60); // 10 minutes
  return {
    id: card.id,
    due: now + interval * DAY,
    interval,
    ease,
    reps: grade === 0 ? 0 : card.reps + 1,
    lapses: card.lapses + (grade === 0 ? 1 : 0),
    lastReviewed: now,
  };
}

export function dueCards(cards: Record<string, ReviewCard>, now = Date.now()): ReviewCard[] {
  return Object.values(cards)
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.due - b.due);
}

export function humanDue(card: ReviewCard, now = Date.now()): string {
  const diff = card.due - now;
  if (diff <= 0) return '今すぐ';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}分後`;
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `${hours}時間後`;
  return `${Math.round(diff / DAY)}日後`;
}
