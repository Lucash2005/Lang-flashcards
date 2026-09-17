import { describe, expect, it } from "vitest";
import {
  applyBackup,
  mergeIncomingCards,
  parseCardsPayload,
  toStoredCard,
} from "./merge";
import { reviewCard } from "./srs";
import type { RemoteCard, StoredCard } from "./types";

const remote: RemoteCard = {
  id: "EN-2026-09-17-dessert",
  lang: "EN",
  front: "dessert",
  back: "甜點",
  date: "2026-09-17",
  createdAt: "2026-09-17T00:00:00+08:00",
};

describe("mergeIncomingCards", () => {
  it("adds new cards without dropping existing ones", () => {
    const existing = [toStoredCard(remote, 1)];
    const jp: RemoteCard = {
      id: "JP-2026-09-17-地震（じしん）",
      lang: "JP",
      front: "地震（じしん）",
      back: "地震",
      date: "2026-09-17",
      createdAt: "2026-09-17T00:00:00+08:00",
    };
    const result = mergeIncomingCards(existing, [remote, jp], 2);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.cards).toHaveLength(2);
  });

  it("updates wording but keeps SRS progress for the same id", () => {
    let stored: StoredCard = toStoredCard(remote, 0);
    stored = reviewCard(stored, "good", 0);
    const incoming: RemoteCard = {
      ...remote,
      back: "甜點；餐後甜食｜I always order a dessert.",
    };
    const result = mergeIncomingCards([stored], [incoming], 99);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    const merged = result.cards[0];
    expect(merged.back).toContain("餐後甜食");
    expect(merged.reps).toBe(stored.reps);
    expect(merged.interval).toBe(stored.interval);
    expect(merged.due).toBe(stored.due);
    expect(merged.ease).toBe(stored.ease);
  });

  it("parses a cards.json envelope", () => {
    const cards = parseCardsPayload({
      version: 1,
      updatedAt: "2026-09-16T23:27:13.491088+00:00",
      cards: [remote],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(remote.id);
  });

  it("applies backup SRS fields by id", () => {
    const local = toStoredCard(remote, 0);
    const backup = reviewCard(local, "easy", 0);
    const next = applyBackup([local], [backup]);
    expect(next[0].interval).toBe(backup.interval);
    expect(next[0].reps).toBe(backup.reps);
  });
});
