import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { runfolioLog } from "@/lib/runfolio-log";

/**
 * Server-only client with elevated privileges. Never import from Client Components.
 * Returns null when `SUPABASE_SERVICE_ROLE_KEY` is unset — ingestion persistence is optional.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (e) {
    runfolioLog.error("supabase.serviceRole", e);
    return null;
  }
}
