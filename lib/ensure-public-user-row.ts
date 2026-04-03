import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";
import {
  clarifySupabaseError,
  isSupabaseMissingSchemaError,
  logSupabaseSchemaIssue
} from "@/lib/supabase-user-error";

/**
 * Ensure `public.users` has a row for this auth user (FK target for races, dismissals, readiness checks).
 */
export async function ensurePublicUserRow(
  supabase: SupabaseClient,
  user: User
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const emailRaw = user.email?.trim() ?? "";
  const email =
    emailRaw || `user-${user.id.replace(/-/g, "")}@runfolio.internal`;

  const metaName =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const name =
    metaName ||
    (email.includes("@") ? email.split("@")[0] : "Runner") ||
    "Runner";

  const { error } = await supabase.from("users").upsert(
    { id: user.id, email, name },
    { onConflict: "id" }
  );

  if (error) {
    logSupabaseSchemaIssue("ensurePublicUserRow", error);
    if (!isSupabaseMissingSchemaError(error))
      runfolioLog.warn("ensurePublicUserRow", error.message, {
        code: error.code,
        hint: error.hint,
        userId: user.id
      });
    return { ok: false, error: clarifySupabaseError(error), code: error.code };
  }

  return { ok: true };
}
