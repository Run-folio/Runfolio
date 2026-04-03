import { NextResponse } from "next/server";
import { getNormalizedRaceResolved } from "@/lib/races/service";
import { importNormalizedRace } from "@/lib/races/canonical/import-pipeline";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { buildInternalRaceId } from "@/lib/races/id";
import type { NormalizedRace, RaceIngestSource } from "@/lib/races/types/normalized";

export const runtime = "nodejs";

const SOURCES = new Set<RaceIngestSource>([
  "active",
  "runsignup",
  "chronotrack",
  "utmb_catalog",
  "raceresult",
  "mock",
  "manual"
]);

/**
 * POST full `NormalizedRace`, or `{ source, sourceRaceId }` to resolve via catalog/provider.
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

  let normalized: NormalizedRace | null = null;

  const b = body as Partial<NormalizedRace> & { source?: string; sourceRaceId?: string };
  if (typeof b.source === "string" && typeof b.sourceRaceId === "string" && b.name === undefined) {
    if (!SOURCES.has(b.source as RaceIngestSource)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    const internalId = buildInternalRaceId(b.source as RaceIngestSource, b.sourceRaceId);
    normalized = await getNormalizedRaceResolved(internalId);
    if (!normalized) {
      return NextResponse.json({ error: "Could not resolve race from provider/catalog" }, { status: 404 });
    }
  } else {
    normalized = body as NormalizedRace;
    if (!normalized?.name || !normalized.source || !normalized.sourceRaceId) {
      return NextResponse.json({ error: "Invalid NormalizedRace payload" }, { status: 400 });
    }
  }

  const result = await importNormalizedRace(normalized);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const, result });
}
