import type { Rating, StoredCard } from "./types";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export function newSrs(
  now = Date.now(),
): Pick<StoredCard, "due" | "interval" | "ease" | "reps" | "lapses" | "status"> {
  return {
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    status: "new",
  };
}

export function isDue(card: StoredCard, now = Date.now()): boolean {
  return card.due <= now;
}

export function previewIntervalDays(card: StoredCard, rating: Rating): string {
  if (rating === "again") return "1 分鐘";
  const dummy = reviewCard(card, rating, Date.now());
  if (dummy.interval <= 1) return `${dummy.interval} 天`;
  return `${dummy.interval} 天`;
}

export function reviewCard(
  card: StoredCard,
  rating: Rating,
  now = Date.now(),
): StoredCard {
  const next: StoredCard = { ...card };

  if (rating === "again") {
    next.lapses += 1;
    next.reps = 0;
    next.interval = 0;
    next.ease = Math.max(1.3, roundEase(next.ease - 0.2));
    next.due = now + MINUTE;
    next.status = "learning";
    return next;
  }

  next.reps += 1;

  if (rating === "easy") {
    next.ease = roundEase(next.ease + 0.15);
    if (card.reps === 0) next.interval = 3;
    else next.interval = Math.max(1, Math.round(card.interval * next.ease * 1.3));
    next.due = now + next.interval * DAY;
    next.status = "review";
    return next;
  }

  // good
  if (card.reps === 0) next.interval = 1;
  else if (card.reps === 1) next.interval = 3;
  else next.interval = Math.max(1, Math.round(card.interval * next.ease));
  next.due = now + next.interval * DAY;
  next.status = "review";
  return next;
}

function roundEase(value: number): number {
  return Math.round(value * 100) / 100;
}
