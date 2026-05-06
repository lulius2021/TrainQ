import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { isUuid } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const user = await getUserFromAuth(auth);
    const { challenge_id } = await req.json();

    if (!isUuid(challenge_id)) {
      return new Response(
        JSON.stringify({ ok: false, error: "valid challenge_id (uuid) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("join_challenge", {
      p_user_id: user.id,
      p_challenge_id: challenge_id,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("challenge-join error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Request failed" }), { status: 500, headers: corsHeaders });
  }
});
