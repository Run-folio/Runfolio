import type { SupabaseClient } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";

/** Matches `AppNavbar`: `/${encodeURIComponent(displayName)}` */
export function profilePathFromDisplayName(displayName: string): string | null {
  const t = displayName.trim();
  if (!t) return null;
  return `/${encodeURIComponent(t)}`;
}

/**
 * All profile URLs that should be revalidated for this user (DB `users.name` and auth metadata/email prefix
 * may differ). Revalidation must hit the same paths the app links to — see `AppNavbar` profileHref.
 */
export async function collectProfileRevalidatePaths(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined) => {
    const path = profilePathFromDisplayName(raw ?? "");
    if (!path || seen.has(path)) return;
    seen.add(path);
    ordered.push(path);
  };

  const { data: row } = await supabase.from("users").select("name").eq("id", userId).maybeSingle();
  add(row?.name ?? null);

  try {
    const { data: auth } = await supabase.auth.getUser();
    const meta = auth?.user?.user_metadata?.name;
    if (typeof meta === "string") add(meta);
    const email = auth?.user?.email;
    if (email && auth?.user?.id === userId) {
      add(email.split("@")[0] ?? null);
    }
  } catch (e) {
    runfolioLog.warn("profilePaths.getUser", e instanceof Error ? e.message : "failed");
  }

  runfolioLog.info("profilePaths.collect", "paths resolved", {
    userId,
    count: ordered.length,
    paths: ordered.join(",")
  });
  return ordered;
}

export async function resolveDefaultProfilePathForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const paths = await collectProfileRevalidatePaths(supabase, userId);
  return paths[0] ?? "/dashboard";
}
