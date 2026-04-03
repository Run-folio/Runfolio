import { NextResponse } from "next/server";
import { importNormalizedRace } from "@/lib/races/canonical/import-pipeline";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { getNormalizedRaceResolved } from "@/lib/races/service";

export const runtime = "nodejs";

/**
 * POST { internalId: "utmb_catalog:xyz" } — re-fetch normalized race and run import pipeline.
 */
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { internalId?: string };
  try {
    body = (await req.json()) as { internalId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const internalId = body.internalId?.trim();
  if (!internalId) {
    return NextResponse.json({ error: "Missing internalId" }, { status: 400 });
  }
  const normalized = await getNormalizedRaceResolved(internalId);
  if (!normalized) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  const result = await importNormalizedRace(normalized);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const, result });
}
