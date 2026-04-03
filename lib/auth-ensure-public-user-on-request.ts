import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePublicUserRow } from "@/lib/ensure-public-user-row";
import { runfolioLog } from "@/lib/runfolio-log";

/**
 * Best-effort `public.users` repair on authenticated server requests (sign-in already upserts; this catches drift
 * and pre-trigger legacy accounts).
 */
export async function ensurePublicUserRowForAuthedRequest(
  supabase: SupabaseClient,
  user: User | null
): Promise<void> {
  if (!user?.id) return;
  const ensured = await ensurePublicUserRow(supabase, user);
  if (!ensured.ok) {
    runfolioLog.error("auth.ensurePublicUserRow", ensured.error, {
      code: ensured.code ?? "",
      userId: user.id
    });
  }
}
