// src/services/garmin/api.ts

import { getSupabaseClient } from "../../lib/supabaseClient";

export interface GarminRecoveryData {
    bodyBattery: number; // 0-100
    stressScore: number; // 0-100
    sleepQuality?: number; // 0-100
    lastSync?: string;
}

export const GarminService = {
    /**
     * Retrieves current recovery status from Garmin via Supabase.
     * Returns null if not connected or no data available.
     * The adaptive engine's fallback chain handles null gracefully.
     */
    getRecoveryStatus: async (): Promise<GarminRecoveryData | null> => {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) return null;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Check if connected
            const { data: tokens } = await supabase
                .from("garmin_tokens")
                .select("is_active")
                .eq("user_id", user.id)
                .single();

            if (!tokens?.is_active) return null;

            // Get latest daily metrics (body battery + stress)
            const { data: metrics } = await supabase
                .from("garmin_daily_metrics")
                .select("body_battery_high, avg_stress_level, synced_at")
                .eq("user_id", user.id)
                .order("calendar_date", { ascending: false })
                .limit(1)
                .single();

            // Get latest sleep score
            const { data: sleep } = await supabase
                .from("garmin_sleep_summaries")
                .select("sleep_score")
                .eq("user_id", user.id)
                .order("calendar_date", { ascending: false })
                .limit(1)
                .single();

            if (!metrics) return null;

            return {
                bodyBattery: metrics.body_battery_high ?? 70,
                stressScore: metrics.avg_stress_level ?? 40,
                sleepQuality: sleep?.sleep_score ?? undefined,
                lastSync: metrics.synced_at,
            };
        } catch {
            return null;
        }
    },
};
