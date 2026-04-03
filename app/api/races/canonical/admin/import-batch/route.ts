import { NextResponse } from "next/server";
import { importNormalizedRacesBatch } from "@/lib/races/canonical/import-pipeline";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import type { NormalizedRace } from "@/lib/races/types/normalized";

export const runtime = "nodejs";

/**
 * POST { races: NormalizedRace[] }
 * Requires `x-runfolio-ingest-secret` when `RACES_INGEST_SECRET` is set.
 */
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const races = (body as { races?: unknown }).races;
  if (!Array.isArray(races)) {
    return NextResponse.json({ error: "Expected body.races array" }, { status: 400 });
  }
  const results = await importNormalizedRacesBatch(races as NormalizedRace[]);
  const summary = results.reduce(
    (acc, r) => {
      if (r.ok) acc[r.action] = (acc[r.action] ?? 0) + 1;
      else acc.failed += 1;
      return acc;
    },
    { created: 0, linked: 0, updated: 0, noop: 0, failed: 0 } as Record<string, number>
  );
  return NextResponse.json({ ok: true as const, results, summary });
}
