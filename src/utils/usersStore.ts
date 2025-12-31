// src/utils/usersStore.ts
export type StoredUser = {
  id: string;
  email: string;
  password: string;
  isPro: boolean;
};

const LS_USERS = "trainq_users_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LS_USERS);
  const parsed = safeParse<StoredUser[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_USERS, JSON.stringify(users));
}

// Optional: Seed nur wenn leer (überschreibt NICHT deine vorhandenen!)
export function ensureUsersSeeded(seed: StoredUser[]) {
  if (typeof window === "undefined") return;
  const existing = loadUsers();
  if (existing.length > 0) return;
  saveUsers(seed);
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return undefined;
  return loadUsers().find((u) => u.email.trim().toLowerCase() === e);
}

export function findUserById(id: string): StoredUser | undefined {
  const v = String(id || "").trim();
  if (!v) return undefined;
  return loadUsers().find((u) => u.id === v);
}