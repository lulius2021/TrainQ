// garmin-auth-init: Initiate OAuth2 PKCE authorization flow.
// Generates code_verifier + code_challenge, stores in temp table, returns authorize URL.

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { generateCodeVerifier, generateState, computeCodeChallenge } from "../_shared/pkce.ts";
import { AUTHORIZE_URL } from "../_shared/garmin-constants.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const user = await getUserFromAuth(auth);
    const clientId = Deno.env.get("GARMIN_CLIENT_ID")!;
    const redirectUri = Deno.env.get("GARMIN_REDIRECT_URI")!;

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await computeCodeChallenge(codeVerifier);
    const state = generateState();

    // Store PKCE state in temp table (10-minute expiry)
    const admin = getSupabaseAdmin();
    await admin.from("garmin_oauth_temp").insert({
      user_id: user.id,
      state,
      code_verifier: codeVerifier,
    });

    // Build Garmin authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    const authorizeUrl = `${AUTHORIZE_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({ authorizeUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("garmin-auth-init error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
