// garmin-disconnect: Disconnect Garmin account.
// Calls Garmin's registration DELETE endpoint, then removes tokens.

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { REGISTRATION_URL } from "../_shared/garmin-constants.ts";
import { resolveAccessToken, type GarminTokenRow } from "../_shared/garmin-tokens.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const user = await getUserFromAuth(auth);
    const admin = getSupabaseAdmin();

    const { data: tokens } = await admin
      .from("garmin_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (tokens) {
      // Try to deregister with Garmin (non-critical)
      try {
        const accessToken = await resolveAccessToken(admin, tokens as GarminTokenRow);
        await fetch(REGISTRATION_URL, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Non-critical — continue with local cleanup
      }

      await admin.from("garmin_tokens").delete().eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("garmin-disconnect error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
