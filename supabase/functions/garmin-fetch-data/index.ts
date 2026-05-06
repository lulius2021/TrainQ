// garmin-fetch-data: Manually pull 7 days of Garmin data (activities, sleep, dailies).
// Uses OAuth2 Bearer tokens with automatic refresh.

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { DAILIES_URL, SLEEPS_URL, ACTIVITIES_URL } from "../_shared/garmin-constants.ts";
import { garminApiFetch, type GarminTokenRow } from "../_shared/garmin-tokens.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const user = await getUserFromAuth(auth);
    const admin = getSupabaseAdmin();

    const { data: tokens } = await admin
      .from("garmin_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!tokens) {
      return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });
    }

    // Rate limit: skip if synced < 5 min ago
    if (tokens.last_sync_at) {
      const lastSync = new Date(tokens.last_sync_at).getTime();
      if (Date.now() - lastSync < 5 * 60 * 1000) {
        return new Response(
          JSON.stringify({ skipped: true, message: "Synced recently, try again later" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60;
    const timeParams = `uploadStartTimeInSeconds=${sevenDaysAgo}&uploadEndTimeInSeconds=${now}`;
    const tokenRow = tokens as GarminTokenRow;

    const counts = { activities: 0, sleep: 0, metrics: 0 };

    async function fetchAndUpsert(baseUrl: string, type: "dailies" | "sleeps" | "activities") {
      const url = `${baseUrl}?${timeParams}`;
      const res = await garminApiFetch(admin, tokenRow, url);

      if (!res.ok) {
        if (res.status === 401) throw new Error("Garmin tokens revoked");
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : [];

      for (const item of items) {
        if (type === "activities") {
          await admin.from("garmin_activities").upsert(
            {
              user_id: user.id,
              garmin_activity_id: item.activityId?.toString() || item.summaryId?.toString(),
              activity_type: item.activityType,
              start_time: item.startTimeInSeconds ? new Date(item.startTimeInSeconds * 1000).toISOString() : null,
              duration_seconds: item.durationInSeconds,
              distance_meters: item.distanceInMeters,
              calories: item.activeKilocalories,
              avg_heart_rate: item.averageHeartRateInBeatsPerMinute,
              max_heart_rate: item.maxHeartRateInBeatsPerMinute,
              avg_speed: item.averageSpeedInMetersPerSecond,
              steps: item.steps,
              summary_json: item,
            },
            { onConflict: "user_id,garmin_activity_id" },
          );
          counts.activities++;
        } else if (type === "sleeps") {
          await admin.from("garmin_sleep_summaries").upsert(
            {
              user_id: user.id,
              garmin_summary_id: item.summaryId?.toString() || item.startTimeInSeconds?.toString(),
              calendar_date: item.calendarDate,
              sleep_start: item.startTimeInSeconds ? new Date(item.startTimeInSeconds * 1000).toISOString() : null,
              sleep_end: item.startTimeInSeconds && item.durationInSeconds
                ? new Date((item.startTimeInSeconds + item.durationInSeconds) * 1000).toISOString()
                : null,
              total_sleep_seconds: item.durationInSeconds,
              deep_sleep_seconds: item.deepSleepDurationInSeconds,
              light_sleep_seconds: item.lightSleepDurationInSeconds,
              rem_sleep_seconds: item.remSleepInSeconds,
              awake_seconds: item.awakeDurationInSeconds,
              sleep_score: item.overallSleepScore?.value || item.sleepScores?.overall?.value,
              summary_json: item,
            },
            { onConflict: "user_id,garmin_summary_id" },
          );
          counts.sleep++;
        } else {
          await admin.from("garmin_daily_metrics").upsert(
            {
              user_id: user.id,
              garmin_summary_id: item.summaryId?.toString() || item.calendarDate,
              calendar_date: item.calendarDate,
              steps: item.steps,
              distance_meters: item.distanceInMeters,
              active_calories: item.activeKilocalories,
              total_calories: item.totalKilocalories,
              resting_heart_rate: item.restingHeartRateInBeatsPerMinute,
              max_heart_rate: item.maxHeartRateInBeatsPerMinute,
              avg_stress_level: item.averageStressLevel,
              body_battery_high: item.bodyBatteryChargedValue,
              body_battery_low: item.bodyBatteryDrainedValue,
              floors_climbed: item.floorsClimbed,
              intensity_minutes: item.moderateIntensityDurationInSeconds
                ? Math.round(item.moderateIntensityDurationInSeconds / 60) + Math.round((item.vigorousIntensityDurationInSeconds || 0) / 60)
                : null,
              summary_json: item,
            },
            { onConflict: "user_id,garmin_summary_id" },
          );
          counts.metrics++;
        }
      }
    }

    await Promise.allSettled([
      fetchAndUpsert(DAILIES_URL, "dailies"),
      fetchAndUpsert(SLEEPS_URL, "sleeps"),
      fetchAndUpsert(ACTIVITIES_URL, "activities"),
    ]);

    // Update last_sync_at
    await admin.from("garmin_tokens").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);

    return new Response(JSON.stringify(counts), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("garmin-fetch-data error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
