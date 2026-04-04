"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CanonicalCurationMeta } from "@/lib/races/canonical/curation-meta";
import {
  CANONICAL_CURATION_LOCK_KEYS,
  type CanonicalCurationLockKey
} from "@/lib/races/canonical/curation-meta";
import type { CanonicalRaceStatus } from "@/lib/races/canonical/types";
import { recomputeCanonicalScores } from "@/lib/races/canonical/scoring";
import {
  clearPortfolioRaceCanonicalLink,
  getCanonicalRaceById,
  insertEditionAlias,
  mergeCanonicalRaceEditionsIntoWinner,
  updateCanonicalRace
} from "@/lib/races/canonical/repository";
import { assertRaceOpsSession, getRaceOpsSecret } from "@/lib/races/internal/race-ops-auth";
import {
  buildRaceOpsSessionCookieValue,
  RACE_OPS_SESSION_COOKIE
} from "@/lib/races/internal/race-ops-token";
import { enqueueCanonicalEnrichmentJobs } from "@/lib/races/canonical/enrichment-jobs";
import {
  scoreActivityAgainstCanonical,
  type ActivityForCanonicalMatch
} from "@/lib/strava-canonical-match/score-activity-canonical";
import { runfolioLog } from "@/lib/runfolio-log";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optStr(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function parseNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDistanceOptions(s: string): number[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseTags(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 48);
}

function parseListFieldKeys(s: string): string[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function raceOpsLoginAction(formData: FormData): Promise<void> {
  const secret = getRaceOpsSecret();
  if (!secret) {
    redirect("/internal/race-ops?e=config");
    return;
  }
  const attempt = str(formData, "secret");
  if (attempt !== secret) {
    redirect("/internal/race-ops?e=auth");
    return;
  }
  const { value, maxAge } = buildRaceOpsSessionCookieValue(secret);
  (await cookies()).set(RACE_OPS_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/internal/race-ops",
    maxAge
  });
  redirect("/internal/race-ops/dashboard");
}

export async function raceOpsLogoutAction() {
  (await cookies()).delete(RACE_OPS_SESSION_COOKIE);
  redirect("/internal/race-ops");
}

export async function raceOpsSaveCanonicalRaceAction(formData: FormData): Promise<void> {
  await assertRaceOpsSession();
  const id = str(formData, "race_id");
  if (!id) return;

  const cur = await getCanonicalRaceById(id);
  if (!cur.ok || !cur.data) return;

  const locks: Record<string, boolean> = { ...cur.data.curationLocked };
  for (const key of CANONICAL_CURATION_LOCK_KEYS) {
    const k = key as CanonicalCurationLockKey;
    if (formData.get(`lock_${k}`) === "on") locks[k] = true;
    else delete locks[k];
  }

  const verifiedFields = parseListFieldKeys(str(formData, "verified_fields"));
  const weakEnrichmentFields = parseListFieldKeys(str(formData, "weak_enrichment_fields"));
  const meta: CanonicalCurationMeta = {
    ...cur.data.curationMeta,
    verifiedFields: verifiedFields.length ? verifiedFields : undefined,
    weakEnrichmentFields: weakEnrichmentFields.length ? weakEnrichmentFields : undefined,
    notes: optStr(str(formData, "curation_notes")),
    lastOpsEditAt: new Date().toISOString()
  };

  const distOpts = parseDistanceOptions(str(formData, "distance_options_km"));

  const next = recomputeCanonicalScores({
    ...cur.data,
    slug: str(formData, "slug") || cur.data.slug,
    name: str(formData, "name") || cur.data.name,
    description: optStr(str(formData, "description")),
    longDescription: optStr(str(formData, "long_description")),
    organizerName: optStr(str(formData, "organizer_name")),
    officialUrl: optStr(str(formData, "official_url")),
    registrationUrl: optStr(str(formData, "registration_url")),
    logoUrl: optStr(str(formData, "logo_url")),
    heroImageUrl: optStr(str(formData, "hero_image_url")),
    fallbackImageUrl: optStr(str(formData, "fallback_image_url")),
    country: optStr(str(formData, "country")),
    region: optStr(str(formData, "region")),
    city: optStr(str(formData, "city")),
    venue: optStr(str(formData, "venue")),
    latitude: parseNum(str(formData, "latitude")),
    longitude: parseNum(str(formData, "longitude")),
    startDate: optStr(str(formData, "start_date")),
    endDate: optStr(str(formData, "end_date")),
    timezone: optStr(str(formData, "timezone")),
    distanceKm: parseNum(str(formData, "distance_km")),
    distanceOptionsKm: distOpts.length ? distOpts : cur.data.distanceOptionsKm,
    elevationGainM: parseNum(str(formData, "elevation_gain_m")),
    raceType: optStr(str(formData, "race_type")),
    surfaceType: optStr(str(formData, "surface_type")),
    categoryTags: parseTags(str(formData, "category_tags")),
    seriesId: optStr(str(formData, "series_id")),
    status: (() => {
      const st = str(formData, "status");
      const allowed: CanonicalRaceStatus[] = [
        "draft",
        "active",
        "hidden",
        "needs_review",
        "duplicate_candidate"
      ];
      return (allowed as readonly string[]).includes(st) ? (st as CanonicalRaceStatus) : cur.data.status;
    })(),
    curationLocked: locks,
    curationMeta: meta,
    updatedAt: new Date().toISOString()
  });

  const upd = await updateCanonicalRace(next);
  if (!upd.ok) {
    runfolioLog.warn("raceOps.save", upd.error, { id });
    return;
  }
  revalidatePath("/internal/race-ops");
  revalidatePath(`/internal/race-ops/races/${id}`);
  revalidatePath(`/races/${upd.data.slug}`);
}

export async function raceOpsEnqueueEnrichmentAction(formData: FormData): Promise<void> {
  await assertRaceOpsSession();
  const id = str(formData, "race_id");
  if (!id) return;
  const r = await enqueueCanonicalEnrichmentJobs([id], 10);
  if (!r.ok) {
    runfolioLog.warn("raceOps.enqueue", r.error, { id });
    return;
  }
  revalidatePath(`/internal/race-ops/races/${id}`);
}

export async function raceOpsMergeEditionsAction(formData: FormData): Promise<void> {
  await assertRaceOpsSession();
  const keepId = str(formData, "keep_id");
  const removeId = str(formData, "remove_id");
  if (!keepId || !removeId) return;
  const m = await mergeCanonicalRaceEditionsIntoWinner(keepId, removeId);
  if (!m.ok) {
    runfolioLog.warn("raceOps.merge", m.error, { keepId, removeId });
    return;
  }
  revalidatePath("/internal/race-ops");
  revalidatePath(`/internal/race-ops/races/${keepId}`);
}

export async function raceOpsAddEditionAliasAction(formData: FormData): Promise<void> {
  await assertRaceOpsSession();
  const raceId = str(formData, "race_id");
  const alias = str(formData, "alias_text");
  const kind = str(formData, "alias_kind") || "variant";
  if (!raceId || !alias) return;
  const ins = await insertEditionAlias({ raceId, aliasText: alias, kind });
  if (!ins.ok) {
    runfolioLog.warn("raceOps.alias", ins.error, { raceId });
    return;
  }
  revalidatePath(`/internal/race-ops/races/${raceId}`);
}

export async function raceOpsUnlinkPortfolioRaceAction(formData: FormData): Promise<void> {
  await assertRaceOpsSession();
  const portfolioRaceId = str(formData, "portfolio_race_id");
  const canonicalRaceId = str(formData, "canonical_race_id");
  if (!portfolioRaceId || !canonicalRaceId) return;
  const c = await clearPortfolioRaceCanonicalLink(portfolioRaceId);
  if (!c.ok) {
    runfolioLog.warn("raceOps.unlink", c.error, { portfolioRaceId });
    return;
  }
  revalidatePath(`/internal/race-ops/races/${canonicalRaceId}`);
  runfolioLog.info("raceOps.unlinkPortfolio", "cleared canonical link", { portfolioRaceId, canonicalRaceId });
}

export async function raceOpsMatchProbeAction(formData: FormData) {
  await assertRaceOpsSession();
  const raceId = str(formData, "race_id");
  if (!raceId) return { ok: false as const, error: "Missing race_id." };
  const raceRes = await getCanonicalRaceById(raceId);
  if (!raceRes.ok || !raceRes.data) return { ok: false as const, error: "Race not found." };

  const act: ActivityForCanonicalMatch = {
    name: str(formData, "act_name") || "Morning Run",
    distanceKm: parseNum(str(formData, "act_distance_km")) ?? 42.2,
    elevationM: parseNum(str(formData, "act_elevation_m")),
    startDateYmd: str(formData, "act_date") || "2024-10-13",
    city: optStr(str(formData, "act_city")),
    country: optStr(str(formData, "act_country")),
    latitude: parseNum(str(formData, "act_lat")),
    longitude: parseNum(str(formData, "act_lng"))
  };

  const breakdown = scoreActivityAgainstCanonical(act, raceRes.data);
  return {
    ok: true as const,
    breakdown: {
      total: breakdown.total,
      distance: breakdown.distance,
      elevation: breakdown.elevation,
      location: breakdown.location,
      date: breakdown.date,
      name: breakdown.name,
      reasons: breakdown.reasons
    }
  };
}
