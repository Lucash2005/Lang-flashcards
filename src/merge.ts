import { newSrs } from "./srs";
import type {
  BackupFile,
  MergeResult,
  RemoteCard,
  StoredCard,
} from "./types";

const LANGS = new Set(["EN", "JP"]);

export function isLang(value: unknown): value is RemoteCard["lang"] {
  return value === "EN" || value === "JP";
}

export function validateRemoteCard(raw: unknown): RemoteCard {
  if (!raw || typeof raw !== "object") {
    throw new Error("卡片格式無效");
  }
  const card = raw as Record<string, unknown>;
  if (typeof card.id !== "string" || card.id.trim() === "") {
    throw new Error("卡片缺少穩定 id");
  }
  if (!isLang(card.lang)) {
    throw new Error(`卡片 ${card.id} 的 lang 必須是 EN 或 JP`);
  }
  if (typeof card.front !== "string" || card.front.trim() === "") {
    throw new Error(`卡片 ${card.id} 缺少正面`);
  }
  if (typeof card.back !== "string" || card.back.trim() === "") {
    throw new Error(`卡片 ${card.id} 缺少背面`);
  }
  return {
    id: card.id,
    lang: card.lang,
    front: card.front,
    back: card.back,
    date: typeof card.date === "string" ? card.date : "",
    createdAt: typeof card.createdAt === "string" ? card.createdAt : "",
  };
}

export function parseCardsPayload(raw: unknown): RemoteCard[] {
  if (Array.isArray(raw)) {
    return raw.map(validateRemoteCard);
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON 格式無效");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.cards)) {
    throw new Error("找不到 cards 陣列");
  }
  return obj.cards.map(validateRemoteCard);
}

export function contentEquals(a: RemoteCard, b: RemoteCard): boolean {
  return (
    a.front === b.front &&
    a.back === b.back &&
    a.lang === b.lang &&
    a.date === b.date &&
    a.createdAt === b.createdAt
  );
}

export function toStoredCard(remote: RemoteCard, now = Date.now()): StoredCard {
  return { ...remote, ...newSrs(now) };
}

export function mergeIncomingCards(
  existing: StoredCard[],
  incoming: RemoteCard[],
  now = Date.now(),
): MergeResult {
  const map = new Map(existing.map((card) => [card.id, card]));
  let added = 0;
  let updated = 0;

  for (const remote of incoming) {
    const prev = map.get(remote.id);
    if (!prev) {
      map.set(remote.id, toStoredCard(remote, now));
      added += 1;
      continue;
    }
    if (!contentEquals(prev, remote)) {
      updated += 1;
    }
    map.set(remote.id, {
      ...prev,
      id: remote.id,
      lang: remote.lang,
      front: remote.front,
      back: remote.back,
      date: remote.date,
      createdAt: remote.createdAt,
    });
  }

  return { cards: [...map.values()], added, updated };
}

export function isStoredCard(raw: unknown): raw is StoredCard {
  if (!raw || typeof raw !== "object") return false;
  const card = raw as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    LANGS.has(String(card.lang)) &&
    typeof card.front === "string" &&
    typeof card.back === "string" &&
    typeof card.due === "number" &&
    typeof card.interval === "number" &&
    typeof card.ease === "number" &&
    typeof card.reps === "number" &&
    typeof card.lapses === "number"
  );
}

export function parseBackupPayload(raw: unknown): BackupFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("備份格式無效");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.cards)) {
    throw new Error("備份缺少 cards 陣列");
  }
  const cards = obj.cards.map((item) => {
    if (isStoredCard(item)) {
      return {
        ...validateRemoteCard(item),
        due: item.due,
        interval: item.interval,
        ease: item.ease,
        reps: item.reps,
        lapses: item.lapses,
        status:
          item.status === "learning" || item.status === "review"
            ? item.status
            : item.reps > 0
              ? "review"
              : "new",
      } satisfies StoredCard;
    }
    return toStoredCard(validateRemoteCard(item));
  });
  return {
    version: typeof obj.version === "number" ? obj.version : 1,
    exportedAt:
      typeof obj.exportedAt === "string"
        ? obj.exportedAt
        : new Date().toISOString(),
    cards,
  };
}

export function applyBackup(
  existing: StoredCard[],
  backup: StoredCard[],
): StoredCard[] {
  const map = new Map(existing.map((card) => [card.id, card]));
  for (const card of backup) {
    map.set(card.id, card);
  }
  return [...map.values()];
}
