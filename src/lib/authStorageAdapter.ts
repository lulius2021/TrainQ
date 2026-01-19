
import { Capacitor } from "@capacitor/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Adapter that uses Keychain/Keystore on Native, and localStorage on Web.
 * Conforms to Supabase `SupportedStorage` interface.
 */
export const authStorageAdapter: SupportedStorage = {
    async getItem(key: string): Promise<string | null> {
        if (Capacitor.isNativePlatform()) {
            try {
                const { value } = await SecureStoragePlugin.get({ key });
                return value;
            } catch {
                // Key not found or error
                return null;
            }
        } else {
            // Web fallback
            if (typeof window === "undefined") return null;
            return window.localStorage.getItem(key);
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            try {
                await SecureStoragePlugin.set({ key, value });
            } catch (e) {
                console.error("SecureStorage set error:", e);
            }
        } else {
            if (typeof window === "undefined") return;
            window.localStorage.setItem(key, value);
        }
    },

    async removeItem(key: string): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            try {
                await SecureStoragePlugin.remove({ key });
            } catch {
                // Ignore if key didn't exist
            }
        } else {
            if (typeof window === "undefined") return;
            window.localStorage.removeItem(key);
        }
    },
};
