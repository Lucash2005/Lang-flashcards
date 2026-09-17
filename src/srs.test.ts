import { describe, expect, it } from "vitest";
import { isDue, newSrs, reviewCard } from "./srs";
import type { StoredCard } from "./types";

function card(overrides: Partial<StoredCard> = {}): StoredCard {
  return {
    id: "EN-test",
    lang: "EN",
    front: "front",
    back: "back",
    date: "2026-09-17",
    createdAt: "2026-09-17T00:00:00+08:00",
    ...newSrs(0),
    ...overrides,
  };
}

describe("srs", () => {
  it("marks new cards due immediately", () => {
    const now = 1_000;
    expect(isDue(card({ ...newSrs(now) }), now)).toBe(true);
  });

  it("Again keeps the card nearly due and lowers ease", () => {
    const now = 10_000;
    const next = reviewCard(card({ ease: 2.5, reps: 4, interval: 10 }), "again", now);
    expect(next.reps).toBe(0);
    expect(next.lapses).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.due).toBe(now + 60_000);
    expect(next.status).toBe("learning");
  });

  it("Good graduates a new card to 1 day", () => {
    const now = 0;
    const next = reviewCard(card({ reps: 0, interval: 0 }), "good", now);
    expect(next.interval).toBe(1);
    expect(next.due).toBe(24 * 60 * 60 * 1000);
    expect(next.status).toBe("review");
  });

  it("Easy uses a longer first interval", () => {
    const next = reviewCard(card({ reps: 0 }), "easy", 0);
    expect(next.interval).toBe(3);
    expect(next.ease).toBe(2.65);
  });
});
