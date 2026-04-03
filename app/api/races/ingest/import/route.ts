import { NextResponse } from "next/server";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { upsertCatalogImport } from "@/lib/races/repository/catalog-imports";
import { getNormalizedRaceByInternalId } from "@/lib/races/service";
import type { NormalizedRace } from "@/lib/races/types/normalized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = {
  internalId?: string;
  race?: NormalizedRace;
};

function isNormalizedRace(x: unknown): x is NormalizedRace {
  if (!x || typeof x !== "object") return false;
  const r = x as NormalizedRace;
  return typeof r.id === "string" && typeof r.source === "string" && typeof r.sourceRaceId === "string";
}

/**
 * Upsert a normalized race into `race_catalog_imports` (requires service role key).
 * Body: `{ internalId }` to refresh from provider, or `{ race }` to persist a client-built payload.
 * Optional: `RACES_INGEST_SECRET` + header `x-runfolio-ingest-secret`.
 */
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!createServiceRoleClient()) {
    return NextResponse.json(
      { error: "Persistence disabled: set SUPABASE_SERVICE_ROLE_KEY and run migration_race_catalog_imports.sql" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let race: NormalizedRace | null = null;
  if (body.race && isNormalizedRace(body.race)) {
    race = body.race;
  } else if (body.internalId?.trim()) {
    race = await getNormalizedRaceByInternalId(body.internalId.trim());
  }

  if (!race) {
    return NextResponse.json({ error: "Provide internalId or a full normalized race object" }, { status: 400 });
  }

  const res = await upsertCatalogImport(race);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const, internalId: race.id });
}
