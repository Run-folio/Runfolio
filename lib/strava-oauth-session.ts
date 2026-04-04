import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Rotates the auth user password (admin API) and signs in on the route-handler Supabase client
 * so session cookies are set on the redirect response. On failure, `logDetail` is for server logs only.
 */
export async function establishSupabaseSessionForUserId(
  routeSupabase: SupabaseClient,
  userId: string,
  email: string
): Promise<{ ok: true } | { ok: false; logDetail: string }> {
  const admin = createServiceRoleClient();
  if (!admin) {
    runfolioLog.error("strava.oauth.session", "service_role_client_unavailable", { userId });
    return { ok: false, logDetail: "service_role_client_unavailable" };
  }
  const password = crypto.randomBytes(32).toString("hex");
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (updErr) {
    runfolioLog.error("strava.oauth.session", "admin_update_user_failed", {
      userId,
      message: updErr.message
    });
    return { ok: false, logDetail: updErr.message };
  }
  const { error: signErr } = await routeSupabase.auth.signInWithPassword({ email, password });
  if (signErr) {
    runfolioLog.error("strava.oauth.session", "sign_in_after_strava_failed", {
      userId,
      message: signErr.message
    });
    return { ok: false, logDetail: signErr.message };
  }
  return { ok: true };
}
