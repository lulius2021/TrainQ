// Shared helper: resolve a valid Garmin access_token, refreshing if expired.

import { TOKEN_URL } from "./garmin-constants.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GarminTokenRow {
  id: string;
  user_id: string;
  garmin_user_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expiry: string;   // ISO timestamp
  is_active: boolean;
  last_sync_at: string | null;
}

/**
 * Returns a valid access_token for the given token row.
 * If the token is expired or about to expire (< 5 min buffer),
 * it refreshes using the refresh_token and updates the DB.
 */
export async function resolveAccessToken(
  admin: SupabaseClient,
  tokens: GarminTokenRow,
): Promise<string> {
  const expiresAt = new Date(tokens.token_expiry).getTime();
  const bufferMs = 5 * 60 * 1000; // 5-minute buffer

  if (Date.now() < expiresAt - bufferMs) {
    return tokens.access_token;
  }

  // Token expired or about to expire → refresh
  const clientId = Deno.env.get("GARMIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GARMIN_CLIENT_SECRET")!;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // If refresh fails with 401/400, mark tokens as inactive
    if (res.status === 401 || res.status === 400) {
      await admin.from("garmin_tokens").update({ is_active: false }).eq("id", tokens.id);
    }
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const newAccessToken: string = data.access_token;
  const newRefreshToken: string = data.refresh_token ?? tokens.refresh_token;
  const expiresIn: number = data.expires_in ?? 3600;
  const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await admin.from("garmin_tokens").update({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_expiry: newExpiry,
  }).eq("id", tokens.id);

  return newAccessToken;
}

/**
 * Fetch a Garmin API URL with a valid Bearer token.
 * Handles token refresh automatically.
 */
export async function garminApiFetch(
  admin: SupabaseClient,
  tokens: GarminTokenRow,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const accessToken = await resolveAccessToken(admin, tokens);

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If 401, the token may have been revoked outside our refresh window
  if (res.status === 401) {
    await admin.from("garmin_tokens").update({ is_active: false }).eq("id", tokens.id);
  }

  return res;
}
