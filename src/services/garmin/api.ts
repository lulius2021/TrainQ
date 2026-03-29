// src/services/garmin/api.ts

import { getSupabaseClient } from "../../lib/supabaseClient";
import type { GarminActivity, GarminDailyMetrics, GarminSleepSummary } from "./types";

export interface GarminRecoveryData {
    bodyBattery: number; // 0-100
    stressScore: number; // 0-100
    sleepQuality?: number; // 0-100
    lastSync?: string;
}

async function getAuthenticatedUser() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: tokens } = await supabase
        .from("garmin_tokens")
        .select("is_active")
        .eq("user_id", user.id)
        .single();
    if (!tokens?.is_active) return null;
    return { supabase, userId: user.id };
}

export const GarminService = {
    getRecoveryStatus: async (): Promise<GarminRecoveryData | null> => {
        try {
            const auth = await getAuthenticatedUser();
            if (!auth) return null;
            const { supabase, userId } = auth;

            const { data: metrics } = await supabase
                .from("garmin_daily_metrics")
                .select("body_battery_high, avg_stress_level, synced_at")
                .eq("user_id", userId)
                .order("calendar_date", { ascending: false })
                .limit(1)
                .single();

            const { data: sleep } = await supabase
                .from("garmin_sleep_summaries")
                .select("sleep_score")
                .eq("user_id", userId)
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

    /** Fetch daily metrics for a date range (stats dashboard). */
    getDailyMetrics: async (from: string, to: string): Promise<GarminDailyMetrics[]> => {
        try {
            const auth = await getAuthenticatedUser();
            if (!auth) return [];
            const { supabase, userId } = auth;

            const { data } = await supabase
                .from("garmin_daily_metrics")
                .select("calendar_date, steps, distance_meters, active_calories, total_calories, resting_heart_rate, max_heart_rate, avg_stress_level, body_battery_high, body_battery_low, floors_climbed, intensity_minutes")
                .eq("user_id", userId)
                .gte("calendar_date", from)
                .lte("calendar_date", to)
                .order("calendar_date", { ascending: true });

            return (data ?? []).map((r: any) => ({
                calendarDate: r.calendar_date,
                steps: r.steps ?? 0,
                distanceMeters: r.distance_meters ?? 0,
                activeCalories: r.active_calories ?? 0,
                totalCalories: r.total_calories ?? 0,
                restingHeartRate: r.resting_heart_rate ?? 0,
                maxHeartRate: r.max_heart_rate ?? 0,
                avgStressLevel: r.avg_stress_level ?? 0,
                bodyBatteryHigh: r.body_battery_high ?? 0,
                bodyBatteryLow: r.body_battery_low ?? 0,
                floorsClimbed: r.floors_climbed ?? 0,
                intensityMinutes: r.intensity_minutes ?? 0,
            }));
        } catch {
            return [];
        }
    },

    /** Fetch sleep summaries for a date range. */
    getSleepSummaries: async (from: string, to: string): Promise<GarminSleepSummary[]> => {
        try {
            const auth = await getAuthenticatedUser();
            if (!auth) return [];
            const { supabase, userId } = auth;

            const { data } = await supabase
                .from("garmin_sleep_summaries")
                .select("calendar_date, sleep_start, sleep_end, total_sleep_seconds, deep_sleep_seconds, light_sleep_seconds, rem_sleep_seconds, awake_seconds, sleep_score")
                .eq("user_id", userId)
                .gte("calendar_date", from)
                .lte("calendar_date", to)
                .order("calendar_date", { ascending: true });

            return (data ?? []).map((r: any) => ({
                calendarDate: r.calendar_date,
                sleepStart: r.sleep_start ?? "",
                sleepEnd: r.sleep_end ?? "",
                totalSleepSeconds: r.total_sleep_seconds ?? 0,
                deepSleepSeconds: r.deep_sleep_seconds ?? 0,
                lightSleepSeconds: r.light_sleep_seconds ?? 0,
                remSleepSeconds: r.rem_sleep_seconds ?? 0,
                awakeSeconds: r.awake_seconds ?? 0,
                sleepScore: r.sleep_score ?? 0,
            }));
        } catch {
            return [];
        }
    },

    /** Fetch Garmin activities for a date range. */
    getActivities: async (from: string, to: string): Promise<GarminActivity[]> => {
        try {
            const auth = await getAuthenticatedUser();
            if (!auth) return [];
            const { supabase, userId } = auth;

            const { data } = await supabase
                .from("garmin_activities")
                .select("garmin_activity_id, activity_type, start_time, duration_seconds, distance_meters, calories, avg_heart_rate, max_heart_rate")
                .eq("user_id", userId)
                .gte("start_time", `${from}T00:00:00`)
                .lte("start_time", `${to}T23:59:59`)
                .order("start_time", { ascending: true });

            return (data ?? []).map((r: any) => ({
                garminActivityId: r.garmin_activity_id,
                activityType: r.activity_type ?? "other",
                startTime: r.start_time ?? "",
                durationSeconds: r.duration_seconds ?? 0,
                distanceMeters: r.distance_meters ?? 0,
                calories: r.calories ?? 0,
                avgHeartRate: r.avg_heart_rate ?? 0,
                maxHeartRate: r.max_heart_rate ?? 0,
            }));
        } catch {
            return [];
        }
    },
};
