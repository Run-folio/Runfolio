import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTrophyCollectionSlugs } from "@/lib/collections/registry";
import { collectProfileRevalidatePaths } from "@/lib/profile-path-server";
import { runfolioLog } from "@/lib/runfolio-log";

export async function revalidatePortfolioSurfaces(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    discoverRaceId?: string | null;
    stravaActivityId?: string | null;
    /** e.g. return_to from confirm flow */
    alsoPaths?: string[];
  }
) {
  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath("/my-races");
  revalidatePath("/bucket-list");
  const profilePaths = await collectProfileRevalidatePaths(supabase, userId);
  for (const p of profilePaths) {
    revalidatePath(p);
  }
  runfolioLog.info("revalidate.surfaces", "invalidated profile + surfaces", {
    userId,
    profilePathCount: profilePaths.length,
    alsoCount: opts?.alsoPaths?.length ?? 0
  });
  if (opts?.discoverRaceId?.trim()) {
    revalidatePath(`/races/${opts.discoverRaceId.trim()}`);
  }
  if (opts?.stravaActivityId?.trim()) {
    revalidatePath(`/activities/${opts.stravaActivityId.trim()}`);
  }
  for (const slug of listTrophyCollectionSlugs()) {
    revalidatePath(`/collections/${slug}`);
  }
  for (const p of opts?.alsoPaths ?? []) {
    if (p.startsWith("/") && !p.startsWith("//") && !p.includes("://")) {
      const clean = p.split("#")[0]?.split("?")[0] ?? p;
      revalidatePath(clean);
    }
  }
}
