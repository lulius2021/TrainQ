// src/utils/testAccountsSeed.ts
// ✅ TestFlight/MVP User Store (LocalStorage)
// ✅ Seed: 10 Pro Accounts + 3 Free Accounts
// ✅ Exports für AuthContext.tsx: findUserByEmail, getAllUsers, updateUser, TrainQUser
// ✅ Zusätzlich: seedTestAccountsOnce() Alias, passend zu App.tsx

export type TrainQUser = {
  id: string;
  email: string;
  password: string;
  displayName?: string;
  isPro: boolean;
  createdAt: string;
};

const USERS_KEY = "trainq_users_v1";
const SEEDED_KEY = "trainq_users_seeded_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

function nowISO(): string {
  return new Date().toISOString();
}

function makeId(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(2, "0")}`;
}

function readUsers(): TrainQUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  const users = safeParse<TrainQUser[]>(raw, []);
  return Array.isArray(users) ? users : [];
}

function writeUsers(users: TrainQUser[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function getAllUsers(): TrainQUser[] {
  return readUsers();
}

export function findUserByEmail(email: string): TrainQUser | undefined {
  const e = normalizeEmail(email);
  if (!e) return undefined;
  return readUsers().find((u) => normalizeEmail(u.email) === e);
}

export function updateUser(userId: string, patch: Partial<TrainQUser>): TrainQUser | null {
  const id = String(userId ?? "").trim();
  if (!id) return null;

  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  const current = users[idx];

  const next: TrainQUser = {
    ...current,
    ...patch,
    id: current.id,
    email: normalizeEmail(patch.email ?? current.email),
    password: String(patch.password ?? current.password),
    isPro: patch.isPro === true ? true : patch.isPro === false ? false : current.isPro,
    createdAt: String(current.createdAt || nowISO()),
  };

  users[idx] = next;
  writeUsers(users);
  return next;
}

/**
 * ✅ Seed einmalig: 10 Pro + 3 Free
 * Password überall: trainq1234
 *
 * pro01@testflight.trainq ... pro10@testflight.trainq
 * free01@testflight.trainq ... free03@testflight.trainq
 */
export function ensureTestAccountsSeeded(): void {
  if (typeof window === "undefined") return;

  try {
    const already = window.localStorage.getItem(SEEDED_KEY) === "1";

    const existing = readUsers();
    const existingEmails = new Set(existing.map((u) => normalizeEmail(u.email)));

    const toAdd: TrainQUser[] = [];
    const pw = "trainq1234";

    for (let i = 1; i <= 10; i++) {
      const email = `pro${String(i).padStart(2, "0")}@testflight.trainq`;
      if (existingEmails.has(normalizeEmail(email))) continue;

      toAdd.push({
        id: makeId("pro", i),
        email: normalizeEmail(email),
        password: pw,
        displayName: `Pro ${String(i).padStart(2, "0")}`,
        isPro: true,
        createdAt: nowISO(),
      });
    }

    for (let i = 1; i <= 3; i++) {
      const email = `free${String(i).padStart(2, "0")}@testflight.trainq`;
      if (existingEmails.has(normalizeEmail(email))) continue;

      toAdd.push({
        id: makeId("free", i),
        email: normalizeEmail(email),
        password: pw,
        displayName: `Free ${String(i).padStart(2, "0")}`,
        isPro: false,
        createdAt: nowISO(),
      });
    }

    if (!already || toAdd.length > 0) {
      writeUsers([...existing, ...toAdd]);
      window.localStorage.setItem(SEEDED_KEY, "1");
    }
  } catch {
    // ignore
  }
}

/**
 * ✅ Alias, damit App.tsx so bleiben kann:
 * import { seedTestAccountsOnce } from "./utils/testAccountsSeed";
 */
export function seedTestAccountsOnce(): void {
  ensureTestAccountsSeeded();
}