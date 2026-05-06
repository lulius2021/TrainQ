import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "EXPIRATION"
  | "UNCANCELLATION"
  | "NON_SUBSCRIPTION_PURCHASE"
  | "SUBSCRIPTION_PAUSED"
  | "TRANSFER";

interface RCEvent {
  id?: string;
  type: RCEventType;
  app_user_id: string;
  aliases?: string[];
  product_id?: string;
  store?: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "AMAZON";
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
  is_trial_conversion?: boolean;
}

interface RCWebhookPayload {
  api_version: string;
  event: RCEvent;
}

const ACTIVE_EVENTS: RCEventType[] = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
];

const INACTIVE_EVENTS: RCEventType[] = [
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIPTION_PAUSED",
];

// Naive in-memory rate limit (per-IP). Edge functions are short-lived,
// so this only catches burst attacks within a single warm container.
const RATE_LIMIT_PER_MIN = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

function storePlatform(store?: string): string | null {
  if (!store) return null;
  if (store === "APP_STORE") return "ios";
  if (store === "PLAY_STORE") return "android";
  if (store === "STRIPE") return "web";
  return store.toLowerCase();
}

// Constant-time string comparison to prevent timing attacks
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // FAIL CLOSED: secret MUST be configured. No secret = no auth = reject everything.
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[rc-webhook] REVENUECAT_WEBHOOK_SECRET not configured — rejecting all requests");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (!safeEquals(auth, secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: RCWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = payload?.event;
  if (!event?.type || !event?.app_user_id) {
    return new Response(JSON.stringify({ error: "Missing event data" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate UUID format to prevent SQL injection / FK errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(event.app_user_id)) {
    console.warn(`[rc-webhook] invalid app_user_id format: ${event.app_user_id}`);
    return new Response(JSON.stringify({ error: "Invalid app_user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = getSupabaseAdmin();
  const userId = event.app_user_id;
  const isActive = ACTIVE_EVENTS.includes(event.type);
  const isInactive = INACTIVE_EVENTS.includes(event.type);

  if (!isActive && !isInactive) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Idempotency: track processed events. If event.id was seen recently, skip.
  if (event.id) {
    const { data: existing } = await admin
      .from("revenuecat_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Verify user exists before upserting (FK would fail otherwise — but silently in upsert)
  const { data: userExists, error: userCheckError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (userCheckError) {
    console.error("[rc-webhook] user check error:", userCheckError);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!userExists) {
    console.warn(`[rc-webhook] user ${userId} not found in profiles — likely RevenueCat anonymous ID`);
    // Return 200 so RevenueCat doesn't retry — this is a config issue, not transient.
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "user_not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const platform = storePlatform(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const profileUpdate: Record<string, unknown> = {
    is_pro: isActive,
    updated_at: new Date().toISOString(),
  };
  if (isActive) {
    if (platform) profileUpdate.subscription_platform = platform;
    if (event.product_id) profileUpdate.subscription_product_id = event.product_id;
    if (expiresAt) profileUpdate.subscription_expires_at = expiresAt;
  } else {
    profileUpdate.subscription_expires_at = expiresAt;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  // FAIL: return 5xx so RevenueCat retries
  if (profileError) {
    console.error("[rc-webhook] profiles update error:", profileError);
    return new Response(JSON.stringify({ error: "DB update failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { plan: isActive ? "pro" : "free" },
  });

  if (metaError) {
    console.error("[rc-webhook] auth metadata update error:", metaError);
    return new Response(JSON.stringify({ error: "Auth update failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Record event for idempotency. Tolerate 23505 (race between concurrent
  // webhooks for the same event); log loudly on any other failure so a
  // broken table doesn't silently disable duplicate detection.
  if (event.id) {
    const { error: logError } = await admin.from("revenuecat_events").insert({
      event_id: event.id,
      event_type: event.type,
      user_id: userId,
      processed_at: new Date().toISOString(),
    });
    if (logError && (logError as { code?: string }).code !== "23505") {
      console.error("[rc-webhook] event log failed:", logError);
    }
  }

  console.log(`[rc-webhook] ${event.type} user=${userId} isPro=${isActive}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
