import { isOfflineDemoMode, isSupabaseConfigured } from "@/lib/demo-mode";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export type PersistenceSnapshot = {
  persistenceAvailable: boolean;
  offlineDemo: boolean;
  missingSupabaseEnv: boolean;
  /** When `persistenceAvailable` is false, explain why saves won’t work. */
  reason: string | null;
};

export function getPersistenceSnapshot(): PersistenceSnapshot {
  const offlineDemo = isOfflineDemoMode();
  const hasUrl = Boolean(getSupabaseUrl());
  const hasKey = Boolean(getSupabaseAnonKey());
  const missingSupabaseEnv = !hasUrl || !hasKey;
  const persistenceAvailable = isSupabaseConfigured();

  let reason: string | null = null;
  if (!persistenceAvailable) {
    if (offlineDemo) {
      reason =
        "Offline demo mode is on (RUNFOLIO_OFFLINE_DEMO). Nothing will be saved until you disable it and use a real Supabase project.";
    } else if (missingSupabaseEnv) {
      reason =
        "Supabase isn’t configured: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) to .env.local and restart.";
    } else {
      reason = "Saving isn’t available in this environment.";
    }
  }

  return { persistenceAvailable, offlineDemo, missingSupabaseEnv, reason };
}
