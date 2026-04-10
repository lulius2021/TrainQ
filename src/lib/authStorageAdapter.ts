
import { Capacitor } from "@capacitor/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Adapter that uses Keychain/Keystore on Native, and localStorage on Web.
 * Conforms to Supabase `SupportedStorage` interface.
 */
function isLockStolen(e: unknown): boolean {
    return String((e as any)?.message ?? "").includes("Lock was stolen");
}

async function secureGet(key: string): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { value } = await SecureStoragePlugin.get({ key });
            return value;
        } catch (e) {
            if (isLockStolen(e) && attempt < 2) {
                await new Promise<void>((r) => setTimeout(r, 40 * (attempt + 1)));
                continue;
            }
            return null;
        }
    }
    return null;
}

async function secureSet(key: string, value: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await SecureStoragePlugin.set({ key, value });
            return;
        } catch (e) {
            if (isLockStolen(e) && attempt < 2) {
                await new Promise<void>((r) => setTimeout(r, 40 * (attempt + 1)));
                continue;
            }
            if (import.meta.env.DEV) console.error("SecureStorage set error:", e);
            return;
        }
    }
}

async function secureRemove(key: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await SecureStoragePlugin.remove({ key });
            return;
        } catch (e) {
            if (isLockStolen(e) && attempt < 2) {
                await new Promise<void>((r) => setTimeout(r, 40 * (attempt + 1)));
                continue;
            }
            return; // Key didn't exist or other error — ignore
        }
    }
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
