const DB_NAME = "trainq_profile_images";
const STORE_NAME = "images";
const DB_VERSION = 1;

type StoredExerciseImage = {
  refId: string;
  blob: Blob;
  mime: string;
  updatedAt: string;
};

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

// -------------------- Profile Image Store API --------------------
// (Adapted from Exercise Image Store)

export async function saveProfileImage(file: File): Promise<{ refId: string; mime: string; updatedAt: string }> {
  // Compression / Resizing could be added here if needed
  const refId = buildRefId();
  const mime = file.type || "application/octet-stream";
  const updatedAt = new Date().toISOString();

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ refId, blob: file, mime, updatedAt } as StoredExerciseImage);
  await waitForTransaction(tx);

  return { refId, mime, updatedAt };
}

export async function loadProfileImageUrl(refId: string): Promise<string> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const record = await requestToPromise<StoredExerciseImage | undefined>(tx.objectStore(STORE_NAME).get(refId));
  await waitForTransaction(tx);
  if (!record?.blob) return "";
  return URL.createObjectURL(record.blob);
}

export async function deleteProfileImage(refId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(refId);
  await waitForTransaction(tx);
}
