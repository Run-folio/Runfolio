import { NextResponse } from "next/server";
import { enqueueCanonicalEnrichmentJobs } from "@/lib/races/canonical/enrichment-jobs";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = {
  raceIds?: string[];
  /** Enqueue active canonical races below this completeness score. */
  lowCompletenessBelow?: number;
  limit?: number;
  priority?: number;
};

/**
 * POST JSON: `{ raceIds: string[] }` or `{ lowCompletenessBelow: 45, limit: 200 }`
 * Requires `x-runfolio-ingest-secret` when `RACES_INGEST_SECRET` is set.
 */
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priority = typeof body.priority === "number" ? body.priority : 0;

  if (Array.isArray(body.raceIds) && body.raceIds.length > 0) {
    const res = await enqueueCanonicalEnrichmentJobs(body.raceIds, priority);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true as const, enqueued: res.enqueued, skipped: res.skipped });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
  }

  const threshold =
    typeof body.lowCompletenessBelow === "number" && body.lowCompletenessBelow > 0
      ? body.lowCompletenessBelow
      : 45;
  const lim = Math.min(Math.max(body.limit ?? 200, 1), 2000);

  const { data, error } = await supabase
    .from("canonical_races")
    .select("id")
    .eq("status", "active")
    .lt("completeness_score", threshold)
    .limit(lim);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((r) => (r as { id: string }).id).filter(Boolean);
  const res = await enqueueCanonicalEnrichmentJobs(ids, priority);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({
    ok: true as const,
    enqueued: res.enqueued,
    skipped: res.skipped,
    candidateCount: ids.length
  });
}
