
import { Capacitor } from "@capacitor/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Adapter that uses Keychain/Keystore on Native, and localStorage on Web.
 * Conforms to Supabase `SupportedStorage` interface.
 *
 * Uses a serial queue (mutex) to prevent concurrent Keychain access
 * which causes "Lock was stolen by another request" errors.
 */

// ─── Serial Queue ────────────────────────────────────────────────────────────
// Ensures only one SecureStorage operation runs at a time.

let _queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = _queue.then(fn, fn);
    _queue = next.then(() => {}, () => {});
    return next;
}

// ─── SecureStorage helpers ───────────────────────────────────────────────────

async function secureGet(key: string): Promise<string | null> {
    return enqueue(async () => {
        try {
            const { value } = await SecureStoragePlugin.get({ key });
            return value;
        } catch {
            return null;
        }
    });
}

async function secureSet(key: string, value: string): Promise<void> {
    return enqueue(async () => {
        try {
            await SecureStoragePlugin.set({ key, value });
        } catch (e) {
            if (import.meta.env.DEV) console.error("[SecureStorage] set failed:", e);
        }
    });
}

async function secureRemove(key: string): Promise<void> {
    return enqueue(async () => {
        try {
            await SecureStoragePlugin.remove({ key });
        } catch {
            // Key didn't exist or other error — ignore
        }
    });
}

export const authStorageAdapter: SupportedStorage = {
    async getItem(key: string): Promise<string | null> {
        if (Capacitor.isNativePlatform()) {
            return secureGet(key);
        } else {
            // Web fallback
            if (typeof window === "undefined") return null;
            return window.localStorage.getItem(key);
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            return secureSet(key, value);
        } else {
            if (typeof window === "undefined") return;
            window.localStorage.setItem(key, value);
        }
    },

    async removeItem(key: string): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            return secureRemove(key);
        } else {
            if (typeof window === "undefined") return;
            window.localStorage.removeItem(key);
        }
    },
};
