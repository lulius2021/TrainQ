// garmin-process-callback: Fetch detailed data from Garmin callback URL (Ping/Pull model).
// Uses OAuth2 Bearer tokens with auto-refresh. Normalizes into DB tables.

import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { garminApiFetch, type GarminTokenRow } from "../_shared/garmin-tokens.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = getSupabaseAdmin();

  try {
    const { callbackUrl, garminUserId, eventType } = await req.json();

    // Look up user tokens by garmin_user_id
    const { data: tokens } = await admin
      .from("garmin_tokens")
      .select("*")
      .eq("garmin_user_id", garminUserId)
      .eq("is_active", true)
      .single();

    if (!tokens) {
      console.error(`No tokens for garmin user ${garminUserId}`);
      return new Response(JSON.stringify({ error: "No tokens found" }), { status: 404 });
    }

    const tokenRow = tokens as GarminTokenRow;

    // Fetch detail data from callback URL with Bearer token
    const res = await garminApiFetch(admin, tokenRow, callbackUrl);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Callback fetch failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      try {
        if (eventType === "activity" || eventType === "activityDetails") {
          await admin.from("garmin_activities").upsert(
            {
              user_id: tokens.user_id,
              garmin_activity_id: item.activityId?.toString() || item.summaryId?.toString(),
              activity_type: item.activityType,
              start_time: item.startTimeInSeconds ? new Date(item.startTimeInSeconds * 1000).toISOString() : null,
              duration_seconds: item.durationInSeconds,
              distance_meters: item.distanceInMeters,
              calories: item.activeKilocalories || item.calories,
              avg_heart_rate: item.averageHeartRateInBeatsPerMinute,
              max_heart_rate: item.maxHeartRateInBeatsPerMinute,
              avg_speed: item.averageSpeedInMetersPerSecond,
              steps: item.steps,
              summary_json: item,
            },
            { onConflict: "user_id,garmin_activity_id" },
          );
        } else if (eventType === "sleeps") {
          await admin.from("garmin_sleep_summaries").upsert(
            {
              user_id: tokens.user_id,
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
        } else {
          // dailies, stressDetails, bodyCompositions, etc. → daily metrics
          await admin.from("garmin_daily_metrics").upsert(
            {
              user_id: tokens.user_id,
              garmin_summary_id: item.summaryId?.toString() || item.startTimeInSeconds?.toString() || item.calendarDate,
              calendar_date: item.calendarDate,
              steps: item.steps,
              distance_meters: item.distanceInMeters,
              active_calories: item.activeKilocalories,
              total_calories: item.totalKilocalories || item.bmrKilocalories,
              resting_heart_rate: item.restingHeartRateInBeatsPerMinute,
              max_heart_rate: item.maxHeartRateInBeatsPerMinute,
              avg_stress_level: item.averageStressLevel,
              body_battery_high: item.bodyBatteryChargedValue || item.bodyBatteryMostRecentValue,
              body_battery_low: item.bodyBatteryDrainedValue,
              floors_climbed: item.floorsClimbed,
              intensity_minutes: item.moderateIntensityDurationInSeconds
                ? Math.round(item.moderateIntensityDurationInSeconds / 60) + Math.round((item.vigorousIntensityDurationInSeconds || 0) / 60)
                : null,
              summary_json: item,
            },
            { onConflict: "user_id,garmin_summary_id" },
          );
        }
      } catch (itemErr) {
        console.error(`Error normalizing ${eventType} item:`, itemErr);
        // Insert into dead letter queue
        await admin.from("garmin_dead_letter").insert({
          event_type: eventType,
          payload: item,
          error_message: itemErr instanceof Error ? itemErr.message : "Unknown",
          stack_trace: itemErr instanceof Error ? itemErr.stack : null,
          next_retry_at: new Date(Date.now() + 30_000).toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ processed: items.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("garmin-process-callback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500 });
  }
});
