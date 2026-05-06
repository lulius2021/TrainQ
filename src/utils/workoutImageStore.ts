// src/utils/workoutImageStore.ts
//
// IndexedDB-backed store for workout post images (the "first export image"
// generated when a workout is completed). localStorage can't hold images at
// scale (5–10MB cap), but IndexedDB easily fits hundreds of PNGs.
//
// API:
//   saveWorkoutImage(workoutId, blob)   — write
//   getWorkoutImage(workoutId)          — read (Blob | null)
//   getWorkoutImageObjectURL(workoutId) — read as object URL ready for <img src>
//   deleteWorkoutImage(workoutId)
//   clearAllWorkoutImages()

const DB_NAME = "trainq_workout_images";
const STORE = "images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB not available"));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });

  // Reset the cached promise on connection close so subsequent calls reopen.
  dbPromise.then(
    (db) => {
      db.onclose = () => { dbPromise = null; };
      db.onerror = () => { dbPromise = null; };
    },
    () => { dbPromise = null; },
  );

  return dbPromise;
}

export async function saveWorkoutImage(workoutId: string, blob: Blob): Promise<void> {
  if (!workoutId || !blob) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, workoutId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[workoutImageStore] save failed", e);
  }
}

export async function getWorkoutImage(workoutId: string): Promise<Blob | null> {
  if (!workoutId) return null;
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(workoutId);
      req.onsuccess = () => {
        const r = req.result as Blob | undefined;
        resolve(r instanceof Blob ? r : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Returns an object URL ready to plug into <img src=...>, or null if missing.
 * Caller is responsible for revoking the URL when no longer needed.
 */
export async function getWorkoutImageObjectURL(workoutId: string): Promise<string | null> {
  const blob = await getWorkoutImage(workoutId);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function deleteWorkoutImage(workoutId: string): Promise<void> {
  if (!workoutId) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(workoutId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function clearAllWorkoutImages(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // ignore
  }
}
