// garmin-webhook-health: Receive health push/ping notifications from Garmin.
// GET = healthcheck (Garmin endpoint verification).
// POST = health data notification → store raw event + trigger callback processor.

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

    // Body can contain multiple event types: dailies, sleeps, bodyCompositions, stressDetails, etc.
    const eventTypes = ["dailies", "sleeps", "epochs", "bodyCompositions", "stressDetails", "userMetrics", "moveIQ"];

    for (const eventType of eventTypes) {
      const summaries = body[eventType];
      if (!Array.isArray(summaries)) continue;

      for (const summary of summaries) {
        const garminUserId = summary.userId?.toString() || summary.userAccessToken || "unknown";
        const summaryId = summary.summaryId || summary.startTimeInSeconds?.toString() || crypto.randomUUID();
        const idempotencyKey = await sha256(`${eventType}:${garminUserId}:${summaryId}`);

        await admin.from("garmin_raw_events").insert({
          event_type: eventType,
          garmin_user_id: garminUserId,
          payload: summary,
          idempotency_key: idempotencyKey,
          request_headers: headers,
        }).then(({ error }) => {
          // ON CONFLICT DO NOTHING — ignore duplicates
          if (error && !error.message.includes("duplicate")) {
            console.error("Insert raw event error:", error);
          }
        });

        // If ping/pull model: invoke callback processor
        if (summary.callbackURL) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            await fetch(`${supabaseUrl}/functions/v1/garmin-process-callback`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ callbackUrl: summary.callbackURL, garminUserId, eventType }),
            });
          } catch (e) {
            console.error("Failed to invoke garmin-process-callback:", e);
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("garmin-webhook-health error:", e);
    return new Response("OK", { status: 200 }); // Always return 200 to Garmin
  }
});
