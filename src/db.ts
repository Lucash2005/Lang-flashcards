import type { StoredCard } from "./types";

const DB_NAME = "lang-flashcards";
const DB_VERSION = 1;
const CARDS_STORE = "cards";
const META_STORE = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CARDS_STORE)) {
        db.createObjectStore(CARDS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("無法開啟 IndexedDB"));
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB 操作失敗"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("交易失敗"));
    tx.onabort = () => reject(tx.error ?? new Error("交易中止"));
  });
}

export async function getAllCards(): Promise<StoredCard[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(CARDS_STORE, "readonly");
    const store = tx.objectStore(CARDS_STORE);
    return await reqToPromise(store.getAll() as IDBRequest<StoredCard[]>);
  } finally {
    db.close();
  }
}

export async function putCard(card: StoredCard): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(CARDS_STORE, "readwrite");
    tx.objectStore(CARDS_STORE).put(card);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function saveAllCards(cards: StoredCard[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(CARDS_STORE, "readwrite");
    const store = tx.objectStore(CARDS_STORE);
    for (const card of cards) {
      store.put(card);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function replaceAllCards(cards: StoredCard[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(CARDS_STORE, "readwrite");
    const store = tx.objectStore(CARDS_STORE);
    store.clear();
    for (const card of cards) {
      store.put(card);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(META_STORE, "readonly");
    const value = await reqToPromise(
      tx.objectStore(META_STORE).get(key) as IDBRequest<string | undefined>,
    );
    return value;
  } finally {
    db.close();
  }
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(value, key);
    await txDone(tx);
  } finally {
    db.close();
  }
}
