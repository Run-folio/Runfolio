import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Rotates the auth password and signs in on the route-handler Supabase client (sets session cookies on response).
 */
export async function establishSupabaseSessionForUserId(
  routeSupabase: SupabaseClient,
  userId: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Server configuration error (missing SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const password = crypto.randomBytes(32).toString("hex");
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (updErr) {
    return { ok: false, message: updErr.message };
  }
  const { error: signErr } = await routeSupabase.auth.signInWithPassword({ email, password });
  if (signErr) {
    return { ok: false, message: signErr.message };
  }
  return { ok: true };
}
