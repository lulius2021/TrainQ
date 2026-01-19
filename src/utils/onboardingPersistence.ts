// src/utils/onboardingPersistence.ts
/**
 * Onboarding Persistence Layer
 * 
 * Prevents onboarding loop by caching completion status in localStorage
 * Primary source: Supabase DB
 * Fallback: localStorage cache
 */

import { getScopedItem, setScopedItem, removeScopedItem } from "./scopedStorage";

const STORAGE_KEY = "trainq_onboarding_completed";

export interface OnboardingStatus {
    completed: boolean;
    userId: string;
    completedAt?: string;
    source: "db" | "cache" | "default";
}

/**
 * Get onboarding status with fallback hierarchy:
 * 1. Database value (passed in)
 * 2. localStorage cache
 * 3. Default (false)
 */
export function getOnboardingStatus(
    userId: string,
    dbValue?: boolean
): OnboardingStatus {
    // Priority 1: Database value
    if (typeof dbValue === "boolean") {
        // Cache it for next time
        if (dbValue) {
            cacheOnboardingCompleted(userId);
        }

        return {
            completed: dbValue,
            userId,
            source: "db"
        };
    }

    // Priority 2: localStorage cache
    const cached = loadOnboardingCache();
    if (cached && cached.userId === userId) {
        return {
            completed: cached.completed,
            userId,
            completedAt: cached.completedAt,
            source: "cache"
        };
    }

    // Priority 3: Default (not completed)
    return {
        completed: false,
        userId,
        source: "default"
    };
}

/**
 * Cache onboarding completion in localStorage
 */
export function cacheOnboardingCompleted(userId: string): void {
    try {
        const data = {
            completed: true,
            userId,
            completedAt: new Date().toISOString()
        };

        setScopedItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("[OnboardingPersistence] Failed to cache completion:", error);
    }
}

/**
 * Clear onboarding cache (e.g., on logout)
 */
export function clearOnboardingCache(): void {
    try {
        removeScopedItem(STORAGE_KEY);
    } catch (error) {
        console.error("[OnboardingPersistence] Failed to clear cache:", error);
    }
}

/**
 * Load cached onboarding status
 */
function loadOnboardingCache(): {
    completed: boolean;
    userId: string;
    completedAt?: string;
} | null {
    try {
        const raw = getScopedItem(STORAGE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw);
        if (!data || typeof data.completed !== "boolean" || !data.userId) {
            return null;
        }

        return data;
    } catch {
        return null;
    }
}

/**
 * Check if onboarding should be shown
 * Returns true if onboarding is needed
 */
export function shouldShowOnboarding(
    userId: string | undefined,
    dbCompleted?: boolean
): boolean {
    if (!userId) return false; // Not logged in

    const status = getOnboardingStatus(userId, dbCompleted);
    return !status.completed;
}
