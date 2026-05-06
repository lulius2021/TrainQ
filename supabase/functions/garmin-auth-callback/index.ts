// garmin-auth-callback: Handle OAuth2 PKCE callback.
// Validates state, exchanges authorization code for tokens, fetches Garmin user ID.

import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { TOKEN_URL, USER_ID_URL } from "../_shared/garmin-constants.ts";

Deno.serve(async (req: Request) => {
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
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    if (!accessToken || typeof accessToken !== "string") {
      console.error("Token exchange returned no access_token");
      return Response.redirect("trainq://garmin-callback?status=error&message=token_exchange_failed", 302);
    }
    if (!refreshToken || typeof refreshToken !== "string") {
      console.error("Token exchange returned no refresh_token");
      return Response.redirect("trainq://garmin-callback?status=error&message=token_exchange_failed", 302);
    }
    const expiresIn: number = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
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

    // Clean up temp row — fail loudly if delete fails so a stale state value
    // can't be replayed.
    const { error: delError } = await admin
      .from("garmin_oauth_temp")
      .delete()
      .eq("id", temp.id);
    if (delError) {
      console.error("garmin-auth-callback temp cleanup failed:", delError);
      throw new Error("Failed to clean up oauth temp row");
    }

    return Response.redirect("trainq://garmin-callback?status=success", 302);
  } catch (e) {
    console.error("garmin-auth-callback error:", e);
    return Response.redirect("trainq://garmin-callback?status=error&message=auth_failed", 302);
  }
});
