import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { runfolioLog } from "@/lib/runfolio-log";

/**
 * Server-only client with elevated privileges (never import from Client Components).
 * Returns null when URL or service-role key is unset.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    runfolioLog.error("supabase.serviceRole.unavailable", "missing_url_or_service_role_key", {
      hasUrl: Boolean(url)
    });
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
