import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

// RevenueCat sends event types that determine subscription state
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
  type: RCEventType;
  app_user_id: string;
  aliases?: string[];
  product_id?: string;
  store?: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "AMAZON";
  expiration_at_ms?: number;
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

function storePlatform(store?: string): string | null {
  if (!store) return null;
  if (store === "APP_STORE") return "ios";
  if (store === "PLAY_STORE") return "android";
  if (store === "STRIPE") return "web";
  return store.toLowerCase();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Verify RevenueCat shared secret
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (secret) {
    const auth = req.headers.get("Authorization");
    if (auth !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

  const admin = getSupabaseAdmin();
  const userId = event.app_user_id;
  const isActive = ACTIVE_EVENTS.includes(event.type);
  const isInactive = INACTIVE_EVENTS.includes(event.type);

  if (!isActive && !isInactive) {
    // Non-subscription events — acknowledge and skip
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const platform = storePlatform(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  // 1. Update profiles table
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
    .upsert({ id: userId, ...profileUpdate }, { onConflict: "id" });

  if (profileError) {
    console.error("profiles upsert error:", profileError);
  }

  // 2. Update auth.users app_metadata via admin API
  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { plan: isActive ? "pro" : "free" },
  });

  if (metaError) {
    console.error("auth metadata update error:", metaError);
  }

  console.log(`[rc-webhook] ${event.type} user=${userId} isPro=${isActive}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
