// garmin-webhook-activity: Receive activity push/ping notifications from Garmin.
// GET = healthcheck (Garmin endpoint verification).
// POST = activity notification → store raw event + trigger callback processor.

import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const encoder = new TextEncoder();

async function sha256(message: string): Promise<string> {
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extract relevant headers for audit trail. */
function extractHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["user-agent", "content-type", "x-garmin-signature", "x-forwarded-for"]) {
    const val = req.headers.get(key);
    if (val) out[key] = val;
  }
  return out;
}

Deno.serve(async (req) => {
  // GET = Garmin healthcheck / endpoint verification
  if (req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();
    const headers = extractHeaders(req);

    const activities = body.activityDetails || body.activities || [];
    if (!Array.isArray(activities)) return new Response("OK", { status: 200 });

    for (const activity of activities) {
      const garminUserId = activity.userId?.toString() || activity.userAccessToken || "unknown";
      const activityId = activity.activityId?.toString() || activity.summaryId || crypto.randomUUID();
      const idempotencyKey = await sha256(`activity:${garminUserId}:${activityId}`);

      await admin.from("garmin_raw_events").insert({
        event_type: "activity",
        garmin_user_id: garminUserId,
        payload: activity,
        idempotency_key: idempotencyKey,
        request_headers: headers,
      }).then(({ error }) => {
        if (error && !error.message.includes("duplicate")) {
          console.error("Insert raw event error:", error);
        }
      });

      // If ping/pull model: invoke callback processor
      if (activity.callbackURL) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/garmin-process-callback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ callbackUrl: activity.callbackURL, garminUserId, eventType: "activity" }),
          });
        } catch (e) {
          console.error("Failed to invoke garmin-process-callback:", e);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("garmin-webhook-activity error:", e);
    return new Response("OK", { status: 200 }); // Always 200 to Garmin
  }
});
