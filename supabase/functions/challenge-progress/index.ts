import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const user = await getUserFromAuth(auth);
    const { participation_id, progress_current } = await req.json();

    if (!participation_id || progress_current === undefined) {
      return new Response(
        JSON.stringify({ ok: false, error: "participation_id and progress_current required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("submit_challenge_progress", {
      p_user_id: user.id,
      p_participation_id: participation_id,
      p_progress: progress_current,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: corsHeaders });
  }
});
