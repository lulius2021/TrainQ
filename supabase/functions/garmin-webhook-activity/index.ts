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

async function verifyGarminSignature(rawBody: string, signature: string, consumerSecret: string): Promise<boolean> {
  try {
    const keyData = encoder.encode(consumerSecret);
    const messageData = encoder.encode(rawBody);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, messageData);
    const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
    return expected === signature.toLowerCase();
  } catch {
    return false;
  }
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
    const rawBody = await req.text();

    // Verify Garmin HMAC-SHA256 signature when secret is configured
    const consumerSecret = Deno.env.get("GARMIN_CONSUMER_SECRET");
    if (consumerSecret) {
      const signature = req.headers.get("x-garmin-signature") ?? "";
      if (!signature) {
        console.warn("garmin-webhook-activity: missing x-garmin-signature header");
        return new Response("Unauthorized", { status: 401 });
      }
      const valid = await verifyGarminSignature(rawBody, signature, consumerSecret);
      if (!valid) {
        console.warn("garmin-webhook-activity: invalid signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    const admin = getSupabaseAdmin();
    const headers = extractHeaders(req);

    const activities = body.activityDetails || body.activities || [];
    if (!Array.isArray(activities)) return new Response("OK", { status: 200 });

    for (const activity of activities) {
      const garminUserId = activity.userId?.toString() || activity.userAccessToken;
      if (!garminUserId) {
        console.warn("Skipping activity webhook entry without userId/userAccessToken");
        continue;
      }
      const activityId = activity.activityId?.toString() || activity.summaryId || crypto.randomUUID();
      const idempotencyKey = await sha256(`activity:${garminUserId}:${activityId}`);

      await admin.from("garmin_raw_events").insert({
        event_type: "activity",
        garmin_user_id: garminUserId,
        payload: activity,
        idempotency_key: idempotencyKey,
        request_headers: headers,
      }).then(({ error }) => {
        if (error && (error as { code?: string }).code !== "23505") {
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
