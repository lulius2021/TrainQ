import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const user = await getUserFromAuth(auth);
    const admin = getSupabaseAdmin();

    const { data } = await admin
      .from("garmin_tokens")
      .select("garmin_user_id, last_sync_at, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    return new Response(
      JSON.stringify({
        connected: !!data,
        garminUserId: data?.garmin_user_id || null,
        lastSyncAt: data?.last_sync_at || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
