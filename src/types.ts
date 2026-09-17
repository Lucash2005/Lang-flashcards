export type Lang = "EN" | "JP";
export type DeckFilter = "all" | Lang;
export type Rating = "again" | "good" | "easy";

export interface RemoteCard {
  id: string;
  lang: Lang;
  front: string;
  back: string;
  date: string;
  createdAt: string;
}

export interface CardsFile {
  version: number;
  updatedAt: string;
  cards: RemoteCard[];
}

export interface StoredCard extends RemoteCard {
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  status: "new" | "learning" | "review";
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  cards: StoredCard[];
}

export interface MergeResult {
  cards: StoredCard[];
  added: number;
  updated: number;
}
