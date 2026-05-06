// delete-account: Permanently delete the authenticated user's account.
// Removes all user data (Garmin tokens, etc.) then deletes the auth user.

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

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

    // Clean up user data before deleting auth record
    await admin.from("garmin_tokens").delete().eq("user_id", user.id);

    // Delete the auth user (cascades to other auth-linked data via RLS)
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("delete-account error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
