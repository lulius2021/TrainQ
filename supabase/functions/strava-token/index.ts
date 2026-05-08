// supabase/functions/strava-token/index.ts
// Server-side Strava OAuth token exchange & refresh.
// Keeps STRAVA_CLIENT_SECRET out of the frontend bundle.

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth } from "../_shared/supabase-admin.ts";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Require authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await getUserFromAuth(authHeader);

    const body = await req.json();
    const { grant_type, code, refresh_token } = body;

    if (!grant_type || (grant_type !== "authorization_code" && grant_type !== "refresh_token")) {
      return new Response(JSON.stringify({ error: "Invalid grant_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Strava not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build request to Strava
    const stravaBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type,
    };

    if (grant_type === "authorization_code") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Missing code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      stravaBody.code = code;
    } else {
      if (!refresh_token) {
        return new Response(JSON.stringify({ error: "Missing refresh_token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      stravaBody.refresh_token = refresh_token;
    }

    const stravaRes = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stravaBody),
    });

    const stravaData = await stravaRes.json();

    if (!stravaRes.ok) {
      return new Response(JSON.stringify({ error: "Strava error", details: stravaData }), {
        status: stravaRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return tokens to client (without exposing the secret)
    return new Response(JSON.stringify(stravaData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
