import { NextResponse } from "next/server";
import { getRaceSourceById } from "@/lib/races/canonical/repository";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";

export const runtime = "nodejs";

/**
 * GET ?id=<canonical_race_sources.uuid>
 * Returns raw_payload and mapped_fields for debugging.
 */
export async function GET(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const row = await getRaceSourceById(id);
  if (!row.ok) {
    return NextResponse.json({ error: row.error }, { status: 500 });
  }
  if (!row.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true as const,
    source: {
      id: row.data.id,
      raceId: row.data.raceId,
      source: row.data.source,
      sourceRaceId: row.data.sourceRaceId,
      sourceUrl: row.data.sourceUrl,
      lastFetchedAt: row.data.lastFetchedAt,
      lastSyncedAt: row.data.lastSyncedAt,
      rawHash: row.data.rawHash,
      rawPayload: row.data.rawPayload,
      mappedFields: row.data.mappedFields
    }
  });
}
