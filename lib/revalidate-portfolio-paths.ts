import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTrophyCollectionSlugs } from "@/lib/collections/registry";

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
  revalidatePath("/bucket-list");
  const { data } = await supabase.from("users").select("name").eq("id", userId).maybeSingle();
  if (data?.name) {
    revalidatePath(`/${data.name}`);
  }
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
      revalidatePath(p);
    }
  }
}
