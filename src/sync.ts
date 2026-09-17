import { getAllCards, saveAllCards, setMeta } from "./db";
import { mergeIncomingCards, parseCardsPayload } from "./merge";
import type { MergeResult, RemoteCard } from "./types";

export function cardsJsonUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}cards.json`;
}

export async function fetchRemoteCards(): Promise<RemoteCard[]> {
  const url = `${cardsJsonUrl()}?t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`無法下載單字庫（${response.status}）`);
  }
  const payload: unknown = await response.json();
  return parseCardsPayload(payload);
}

export async function syncFromRemote(): Promise<MergeResult> {
  const incoming = await fetchRemoteCards();
  const existing = await getAllCards();
  const result = mergeIncomingCards(existing, incoming);
  await saveAllCards(result.cards);
  await setMeta("lastSyncAt", new Date().toISOString());
  await setMeta("cardsUpdatedHint", String(incoming.length));
  return result;
}

export async function mergePastedJson(text: string): Promise<MergeResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("貼上的內容不是有效 JSON");
  }
  const incoming = parseCardsPayload(payload);
  const existing = await getAllCards();
  const result = mergeIncomingCards(existing, incoming);
  await saveAllCards(result.cards);
  return result;
}
