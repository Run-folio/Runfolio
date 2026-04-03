import { computeRunningProfileStats } from "@/lib/running-profile/stats";
import { profileApprovedCompletedRaces } from "@/lib/portfolio-race";
import { fetchPublicProfileBundle } from "@/lib/supabase/fetch-public-profile";

type Ctx = { params: Promise<{ username: string }> };

/**
 * Programmatic profile snapshot (published races + stats). Useful for future share cards / integrations.
 * Respects `runner.profile_public`: returns 404 JSON when private and unauthenticated context cannot access.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { username } = await ctx.params;
  const bundle = await fetchPublicProfileBundle(username);
  if (!bundle.runner) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (bundle.runner.profile_public === false) {
    return Response.json({ error: "private" }, { status: 404 });
  }
  const published = profileApprovedCompletedRaces(bundle.races ?? []);
  const stats = computeRunningProfileStats(published);
  return Response.json({
    runner: {
      id: bundle.runner.id,
      name: bundle.runner.name,
      profile_location: bundle.runner.profile_location,
      profile_tagline: bundle.runner.profile_tagline
    },
    stats,
    races: published
  });
}
