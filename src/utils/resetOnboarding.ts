// src/utils/resetOnboarding.ts
/**
 * Reset Onboarding Utility
 * 
 * Allows users to restart the onboarding flow from Settings
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import { clearOnboardingCache } from "./onboardingPersistence";

export interface ResetOnboardingResult {
    success: boolean;
    error?: string;
}

/**
 * Resets onboarding status for the current user
 * 
 * Steps:
 * 1. Clear localStorage cache
 * 2. Update Supabase profile to mark onboarding as incomplete
 * 3. Reload app to trigger onboarding flow
 */
export async function resetOnboarding(userId: string): Promise<ResetOnboardingResult> {
    try {
        // Step 1: Clear cache
        clearOnboardingCache();

        // Step 2: Update database
        const client = getSupabaseClient();
        if (client) {
            const { error } = await client
                .from('profiles')
                .update({ onboarding_completed: false })
                .eq('id', userId);

            if (error) {
                if (import.meta.env.DEV) console.error("[ResetOnboarding] DB update failed:", error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        // Step 3: Success - app will reload and show onboarding
        return { success: true };

    } catch (error) {
        if (import.meta.env.DEV) console.error("[ResetOnboarding] Unexpected error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Reset onboarding and reload app
 * Use this in Settings UI
 */
export async function resetOnboardingAndReload(userId: string): Promise<void> {
    const result = await resetOnboarding(userId);

    if (result.success) {
        // Force reload to trigger onboarding
        window.location.href = "/";
    } else {
        throw new Error(result.error || "Failed to reset onboarding");
    }
}
