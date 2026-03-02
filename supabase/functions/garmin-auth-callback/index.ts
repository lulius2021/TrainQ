// garmin-auth-callback: Handle OAuth2 PKCE callback.
// Validates state, exchanges authorization code for tokens, fetches Garmin user ID.

import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { TOKEN_URL, USER_ID_URL } from "../_shared/garmin-constants.ts";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return Response.redirect("trainq://garmin-callback?status=error&message=missing_params", 302);
    }

    const admin = getSupabaseAdmin();
    const clientId = Deno.env.get("GARMIN_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GARMIN_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GARMIN_REDIRECT_URI")!;

    // Look up temp row by state (CSRF validation)
    const { data: temp } = await admin
      .from("garmin_oauth_temp")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!temp) {
      return Response.redirect("trainq://garmin-callback?status=error&message=state_invalid_or_expired", 302);
    }

    // Exchange authorization code for tokens using PKCE
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: temp.code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, errText);
      return Response.redirect("trainq://garmin-callback?status=error&message=token_exchange_failed", 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in ?? 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch Garmin user ID
    let garminUserId: string | null = null;
    try {
      const userIdRes = await fetch(USER_ID_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userIdRes.ok) {
        const userIdData = await userIdRes.json();
        garminUserId = userIdData.userId?.toString() || null;
      }
    } catch (e) {
      console.error("Failed to fetch Garmin user ID:", e);
    }

    // Upsert tokens
    await admin.from("garmin_tokens").upsert(
      {
        user_id: temp.user_id,
        garmin_user_id: garminUserId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry,
        connected_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: "user_id" },
    );

    // Clean up temp row
    await admin.from("garmin_oauth_temp").delete().eq("id", temp.id);

    return Response.redirect("trainq://garmin-callback?status=success", 302);
  } catch (e) {
    console.error("garmin-auth-callback error:", e);
    const msg = e instanceof Error ? encodeURIComponent(e.message) : "unknown";
    return Response.redirect(`trainq://garmin-callback?status=error&message=${msg}`, 302);
  }
});
