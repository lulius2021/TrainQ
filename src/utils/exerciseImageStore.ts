import { getActiveUserId } from "./session";

const DB_NAME = "trainq_exercise_images";
const STORE_NAME = "images";
const DB_VERSION = 1;

type StoredExerciseImage = {
  refId: string;     // composite key: `${userId}::${rawRefId}` — see scopedKey()
  blob: Blob;
  mime: string;
  updatedAt: string;
};

// Prefix every record key with the active userId so account A's images can
// never be retrieved by account B. The DB itself is shared (changing DB
// names mid-session would force connection reopens), but per-record keys
// give us isolation.
function scopedKey(rawRefId: string): string {
  const uid = getActiveUserId() || "anon";
  return `${uid}::${rawRefId}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "refId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });

  return dbPromise;
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction error"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function buildRefId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function saveExerciseImage(file: File): Promise<{ refId: string; mime: string; updatedAt: string }> {
  // The raw refId is what we hand back to the caller and what gets stored
  // inside the Exercise.image object. The IDB key is the user-scoped variant
  // so cross-account reads can't find it.
  const rawRefId = buildRefId();
  const storeKey = scopedKey(rawRefId);
  const mime = file.type || "application/octet-stream";
  const updatedAt = new Date().toISOString();

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ refId: storeKey, blob: file, mime, updatedAt } as StoredExerciseImage);
  await waitForTransaction(tx);

  return { refId: rawRefId, mime, updatedAt };
}

export async function loadExerciseImageUrl(refId: string): Promise<string> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  // Try user-scoped key first; fall back to legacy unscoped key for images
  // saved before this fix. A legacy hit auto-migrates to the scoped key.
  const scoped = scopedKey(refId);
  let record = await requestToPromise<StoredExerciseImage | undefined>(tx.objectStore(STORE_NAME).get(scoped));
  if (!record?.blob) {
    record = await requestToPromise<StoredExerciseImage | undefined>(tx.objectStore(STORE_NAME).get(refId));
  }
  await waitForTransaction(tx);
  if (!record?.blob) return "";

  // If we hit the legacy entry, migrate it under the scoped key for next read.
  if (record.refId === refId) {
    try {
      const tx2 = db.transaction(STORE_NAME, "readwrite");
      tx2.objectStore(STORE_NAME).put({ ...record, refId: scoped });
      tx2.objectStore(STORE_NAME).delete(refId);
      await waitForTransaction(tx2);
    } catch {
      // Migration is best-effort; the read result is still valid.
    }
  }
  return URL.createObjectURL(record.blob);
}

export async function deleteExerciseImage(refId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  // Delete both scoped and legacy entries to be safe.
  tx.objectStore(STORE_NAME).delete(scopedKey(refId));
  tx.objectStore(STORE_NAME).delete(refId);
  await waitForTransaction(tx);
}

/**
 * Removes ALL exercise images for a given userId. Called by clearUserScopedData
 * on logout so leftover blobs don't accumulate across account switches.
 */
export async function clearExerciseImagesForUser(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const prefix = `${userId}::`;
    const keys = await requestToPromise<IDBValidKey[]>(store.getAllKeys());
    for (const k of keys) {
      if (typeof k === "string" && k.startsWith(prefix)) {
        store.delete(k);
      }
    }
    await waitForTransaction(tx);
  } catch {
    // ignore — best-effort cleanup
  }
}
