import { normalizeRaceName } from "@/lib/races/dedupe";
import { sourceTrustRank } from "@/lib/races/canonical/source-trust";
import type {
  CanonicalEnrichmentStatus,
  CanonicalRace,
  CanonicalRaceSource,
  CanonicalRaceStatus,
  CanonicalSearchFilters
} from "@/lib/races/canonical/types";
import { MIN_ACTIVE_SEARCH_COMPLETENESS } from "@/lib/races/canonical/scoring";
import type { RaceIngestSource } from "@/lib/races/types/normalized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

const RACES = "canonical_races";
const SOURCES = "canonical_race_sources";

export type CanonicalRaceRow = {
  id: string;
  slug: string;
  series_id?: string | null;
  name: string;
  description: string | null;
  long_description: string | null;
  organizer_name: string | null;
  official_url: string | null;
  registration_url: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  fallback_image_url: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  distance_km: number | null;
  distance_options_km: number[] | null;
  elevation_gain_m: number | null;
  race_type: string | null;
  surface_type: string | null;
  category_tags: string[] | null;
  difficulty_score: number | null;
  utmb_index_eligible: boolean | null;
  utmb_category: string | null;
  is_trail: boolean | null;
  is_road: boolean | null;
  is_ultra: boolean | null;
  quality_score: number;
  completeness_score: number;
  quality_flags: Record<string, boolean> | null;
  status: CanonicalRaceStatus;
  enrichment_status: CanonicalEnrichmentStatus;
  last_enriched_at: string | null;
  enrichment_meta: Record<string, unknown> | null;
  curation_locked: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

type CanonicalRaceSourceRow = {
  id: string;
  race_id: string;
  source: RaceIngestSource;
  source_race_id: string;
  source_url: string | null;
  last_fetched_at: string | null;
  last_synced_at: string | null;
  raw_payload: Record<string, unknown> | null;
  raw_hash: string | null;
  mapped_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function raceRowToDomain(row: CanonicalRaceRow): CanonicalRace {
  return {
    id: row.id,
    slug: row.slug,
    seriesId: row.series_id ?? null,
    name: row.name,
    description: row.description,
    longDescription: row.long_description ?? null,
    organizerName: row.organizer_name,
    officialUrl: row.official_url,
    registrationUrl: row.registration_url,
    logoUrl: row.logo_url,
    heroImageUrl: row.hero_image_url,
    fallbackImageUrl: row.fallback_image_url ?? null,
    country: row.country,
    region: row.region,
    city: row.city,
    venue: row.venue,
    latitude: row.latitude,
    longitude: row.longitude,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    distanceKm: row.distance_km,
    distanceOptionsKm: Array.isArray(row.distance_options_km) ? row.distance_options_km : [],
    elevationGainM: row.elevation_gain_m,
    raceType: row.race_type,
    surfaceType: row.surface_type,
    categoryTags: row.category_tags ?? [],
    difficultyScore: row.difficulty_score,
    utmbIndexEligible: row.utmb_index_eligible,
    utmbCategory: row.utmb_category,
    isTrail: row.is_trail,
    isRoad: row.is_road,
    isUltra: row.is_ultra,
    qualityScore: row.quality_score,
    completenessScore: row.completeness_score,
    qualityFlags: row.quality_flags ?? {},
    status: row.status,
    enrichmentStatus: row.enrichment_status ?? "never",
    lastEnrichedAt: row.last_enriched_at ?? null,
    enrichmentMeta: row.enrichment_meta ?? {},
    curationLocked: row.curation_locked ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sourceRowToDomain(row: CanonicalRaceSourceRow): CanonicalRaceSource {
  return {
    id: row.id,
    raceId: row.race_id,
    source: row.source,
    sourceRaceId: row.source_race_id,
    sourceUrl: row.source_url,
    lastFetchedAt: row.last_fetched_at,
    lastSyncedAt: row.last_synced_at,
    rawPayload: row.raw_payload,
    rawHash: row.raw_hash,
    mappedFields: row.mapped_fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function domainToRaceRowPatch(r: CanonicalRace): Record<string, unknown> {
  return {
    slug: r.slug,
    series_id: r.seriesId,
    name: r.name,
    description: r.description,
    long_description: r.longDescription,
    organizer_name: r.organizerName,
    official_url: r.officialUrl,
    registration_url: r.registrationUrl,
    logo_url: r.logoUrl,
    hero_image_url: r.heroImageUrl,
    fallback_image_url: r.fallbackImageUrl,
    country: r.country,
    region: r.region,
    city: r.city,
    venue: r.venue,
    latitude: r.latitude,
    longitude: r.longitude,
    start_date: r.startDate,
    end_date: r.endDate,
    timezone: r.timezone,
    distance_km: r.distanceKm,
    distance_options_km: r.distanceOptionsKm,
    elevation_gain_m: r.elevationGainM,
    race_type: r.raceType,
    surface_type: r.surfaceType,
    category_tags: r.categoryTags,
    difficulty_score: r.difficultyScore,
    utmb_index_eligible: r.utmbIndexEligible,
    utmb_category: r.utmbCategory,
    is_trail: r.isTrail,
    is_road: r.isRoad,
    is_ultra: r.isUltra,
    quality_score: r.qualityScore,
    completeness_score: r.completenessScore,
    quality_flags: r.qualityFlags,
    status: r.status,
    enrichment_status: r.enrichmentStatus,
    last_enriched_at: r.lastEnrichedAt,
    enrichment_meta: r.enrichmentMeta,
    curation_locked: r.curationLocked,
    updated_at: r.updatedAt
  };
}

export type RepositoryResult<T> = { ok: true; data: T } | { ok: false; error: string };

function noClient(): RepositoryResult<never> {
  return { ok: false, error: "Service role client not configured (SUPABASE_SERVICE_ROLE_KEY)." };
}

export async function allocateUniqueSlug(base: string): Promise<RepositoryResult<string>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  let candidate = base.slice(0, 120);
  for (let i = 0; i < 24; i++) {
    const { data } = await supabase.from(RACES).select("id").eq("slug", candidate).maybeSingle();
    if (!data) return { ok: true, data: candidate };
    candidate = `${base}-v${i + 2}`.slice(0, 120);
  }
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { ok: true, data: `${base}-${id}`.slice(0, 120) };
}

export async function getCanonicalRaceById(id: string): Promise<RepositoryResult<CanonicalRace | null>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const { data, error } = await supabase.from(RACES).select("*").eq("id", id).maybeSingle();
  if (error) {
    runfolioLog.warn("canonical.repo.getRace", error.message, { id });
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: raceRowToDomain(data as CanonicalRaceRow) };
}

const CANONICAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,118}$/i;

/**
 * Public detail lookup: **active** canonical races only (slug or UUID). Invalid ref shape → null data (not an error).
 * Uses service role so pages work without per-user RLS (same as search pipeline).
 */
export async function getActiveCanonicalRaceByRef(ref: string): Promise<RepositoryResult<CanonicalRace | null>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const raw = decodeURIComponent(ref).trim();
  if (!raw) return { ok: true, data: null };

  let q = supabase.from(RACES).select("*").eq("status", "active");
  if (CANONICAL_UUID_RE.test(raw)) {
    q = q.eq("id", raw);
  } else if (CANONICAL_SLUG_RE.test(raw)) {
    q = q.eq("slug", raw.toLowerCase());
  } else {
    return { ok: true, data: null };
  }

  const { data, error } = await q.maybeSingle();
  if (error) {
    runfolioLog.warn("canonical.repo.getActiveByRef", error.message, { ref: raw });
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: raceRowToDomain(data as CanonicalRaceRow) };
}

export async function insertCanonicalRace(race: CanonicalRace): Promise<RepositoryResult<CanonicalRace>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const row = {
    id: race.id,
    ...domainToRaceRowPatch(race),
    created_at: race.createdAt,
    updated_at: race.updatedAt
  };
  const { data, error } = await supabase.from(RACES).insert(row).select("*").single();
  if (error) {
    runfolioLog.error("canonical.repo.insertRace", error, { slug: race.slug });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: raceRowToDomain(data as CanonicalRaceRow) };
}

export async function updateCanonicalRace(race: CanonicalRace): Promise<RepositoryResult<CanonicalRace>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const patch = domainToRaceRowPatch(race);
  const { data, error } = await supabase.from(RACES).update(patch).eq("id", race.id).select("*").single();
  if (error) {
    runfolioLog.error("canonical.repo.updateRace", error, { id: race.id });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: raceRowToDomain(data as CanonicalRaceRow) };
}

export async function setCanonicalRaceStatus(
  id: string,
  status: CanonicalRaceStatus
): Promise<RepositoryResult<CanonicalRace>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(RACES)
    .update({ status, updated_at: now })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    runfolioLog.error("canonical.repo.setStatus", error, { id, status });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: raceRowToDomain(data as CanonicalRaceRow) };
}

export async function getSourceByProviderKey(
  source: RaceIngestSource,
  sourceRaceId: string
): Promise<RepositoryResult<CanonicalRaceSource | null>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const { data, error } = await supabase
    .from(SOURCES)
    .select("*")
    .eq("source", source)
    .eq("source_race_id", sourceRaceId)
    .maybeSingle();
  if (error) {
    runfolioLog.warn("canonical.repo.getSource", error.message, { source, sourceRaceId });
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: sourceRowToDomain(data as CanonicalRaceSourceRow) };
}

export async function listSourcesForRace(raceId: string): Promise<RepositoryResult<CanonicalRaceSource[]>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const { data, error } = await supabase.from(SOURCES).select("*").eq("race_id", raceId);
  if (error) {
    runfolioLog.warn("canonical.repo.listSources", error.message, { raceId });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data as CanonicalRaceSourceRow[]).map(sourceRowToDomain) };
}

export async function maxSourceTrustForRaceExcluding(
  raceId: string,
  exclude?: { source: RaceIngestSource; sourceRaceId: string }
): Promise<RepositoryResult<number>> {
  const listed = await listSourcesForRace(raceId);
  if (!listed.ok) return { ok: false, error: listed.error };
  let max = 0;
  for (const s of listed.data) {
    if (exclude && s.source === exclude.source && s.sourceRaceId === exclude.sourceRaceId) continue;
    max = Math.max(max, sourceTrustRank(s.source));
  }
  return { ok: true, data: max };
}

export async function upsertRaceSourceRow(args: {
  id?: string;
  raceId: string;
  source: RaceIngestSource;
  sourceRaceId: string;
  sourceUrl: string | null;
  rawPayload: Record<string, unknown> | null;
  rawHash: string;
  mappedFields: Record<string, unknown>;
  now: string;
}): Promise<RepositoryResult<CanonicalRaceSource>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const row: Record<string, unknown> = {
    race_id: args.raceId,
    source: args.source,
    source_race_id: args.sourceRaceId,
    source_url: args.sourceUrl,
    last_fetched_at: args.now,
    last_synced_at: args.now,
    raw_payload: args.rawPayload,
    raw_hash: args.rawHash,
    mapped_fields: args.mappedFields,
    updated_at: args.now
  };
  if (args.id) row.id = args.id;
  const { data, error } = await supabase
    .from(SOURCES)
    .upsert(row, { onConflict: "source,source_race_id" })
    .select("*")
    .single();
  if (error) {
    runfolioLog.error("canonical.repo.upsertSource", error, {
      source: args.source,
      sourceRaceId: args.sourceRaceId
    });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: sourceRowToDomain(data as CanonicalRaceSourceRow) };
}

export async function touchRaceSourceSyncedAt(
  sourceRowId: string,
  now: string
): Promise<RepositoryResult<void>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const { error } = await supabase
    .from(SOURCES)
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", sourceRowId);
  if (error) {
    runfolioLog.warn("canonical.repo.touchSource", error.message, { sourceRowId });
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getRaceSourceById(
  sourceRowId: string
): Promise<RepositoryResult<CanonicalRaceSource | null>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const { data, error } = await supabase.from(SOURCES).select("*").eq("id", sourceRowId).maybeSingle();
  if (error) {
    runfolioLog.warn("canonical.repo.getSourceById", error.message, { sourceRowId });
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: sourceRowToDomain(data as CanonicalRaceSourceRow) };
}

/**
 * Candidate canonical races for dedupe (same calendar day and/or name token).
 */
export async function findImportMatchCandidates(args: {
  nameTokens: string[];
  startDateYmd: string | null;
  limit?: number;
}): Promise<RepositoryResult<CanonicalRace[]>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const token =
    args.nameTokens.find((t) => t.length > 2) ?? args.nameTokens[0] ?? "";
  if (!args.startDateYmd && !token) {
    return { ok: true, data: [] };
  }
  const lim = Math.min(args.limit ?? 60, 120);
  let q = supabase.from(RACES).select("*").neq("status", "hidden").limit(lim);
  if (args.startDateYmd) {
    q = q.eq("start_date", args.startDateYmd);
  }
  if (token) {
    q = q.ilike("name", `%${token.slice(0, 48)}%`);
  }
  const { data, error } = await q;
  if (error) {
    runfolioLog.warn("canonical.repo.candidates", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data as CanonicalRaceRow[]).map(raceRowToDomain) };
}

function escapeIlikeFragment(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function applyPassiveSearchFilters(rows: CanonicalRace[], filters: CanonicalSearchFilters): CanonicalRace[] {
  let out = rows;
  if (filters.country?.trim()) {
    const c = filters.country.trim().toLowerCase();
    out = out.filter((r) => r.country?.toLowerCase().includes(c));
  }
  if (filters.city?.trim()) {
    const c = filters.city.trim().toLowerCase();
    out = out.filter((r) => r.city?.toLowerCase().includes(c));
  }
  if (filters.trailOnly) out = out.filter((r) => r.isTrail === true);
  if (filters.ultraOnly) out = out.filter((r) => r.isUltra === true);
  if (filters.distanceMinKm != null) {
    out = out.filter((r) => r.distanceKm != null && r.distanceKm >= filters.distanceMinKm!);
  }
  if (filters.distanceMaxKm != null) {
    out = out.filter((r) => r.distanceKm != null && r.distanceKm <= filters.distanceMaxKm!);
  }
  if (filters.dateFrom?.trim()) {
    const df = filters.dateFrom.trim();
    out = out.filter((r) => r.startDate && r.startDate >= df);
  }
  if (filters.dateTo?.trim()) {
    const dt = filters.dateTo.trim();
    out = out.filter((r) => r.startDate && r.startDate <= dt);
  }
  return out;
}

async function searchCanonicalRacesWithTextQuery(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  filters: CanonicalSearchFilters,
  resultLimit: number
): Promise<RepositoryResult<CanonicalRace[]>> {
  const rawQ = filters.query!.trim().replace(/,/g, " ");
  const esc = escapeIlikeFragment(rawQ);
  const pat = `%${esc}%`;
  const mk = () =>
    supabase
      .from(RACES)
      .select("*")
      .eq("status", "active")
      .gte("completeness_score", MIN_ACTIVE_SEARCH_COMPLETENESS);

  const [nameRes, cityRes, countryRes, regionRes] = await Promise.all([
    mk().ilike("name", pat).limit(40),
    mk().ilike("city", pat).limit(30),
    mk().ilike("country", pat).limit(30),
    mk().ilike("region", pat).limit(30)
  ]);

  const merged = new Map<string, CanonicalRace>();
  const absorb = (res: { data: unknown; error: { message: string } | null } | null) => {
    if (!res || res.error) return;
    for (const row of (res.data ?? []) as CanonicalRaceRow[]) {
      const d = raceRowToDomain(row);
      merged.set(d.id, d);
    }
  };
  absorb(nameRes);
  absorb(cityRes);
  absorb(countryRes);
  absorb(regionRes);

  try {
    const normalized = normalizeRaceName(rawQ).replace(/\s+/g, " ").trim();
    const normPat = normalized.length > 0 ? `%${escapeIlikeFragment(normalized)}%` : pat;
    const [al1, al2] = await Promise.all([
      supabase.from("canonical_race_alias").select("race_id,series_id").ilike("alias_text", pat).limit(80),
      supabase.from("canonical_race_alias").select("race_id,series_id").ilike("alias_normalized", normPat).limit(80)
    ]);
    const raceIds = new Set<string>();
    const seriesIds = new Set<string>();
    for (const chunk of [al1.data, al2.data]) {
      for (const row of chunk ?? []) {
        const r = row as { race_id?: string | null; series_id?: string | null };
        if (r.race_id) raceIds.add(r.race_id);
        if (r.series_id) seriesIds.add(r.series_id);
      }
    }
    if (raceIds.size > 0) {
      const { data, error } = await supabase
        .from(RACES)
        .select("*")
        .in("id", [...raceIds])
        .eq("status", "active")
        .gte("completeness_score", MIN_ACTIVE_SEARCH_COMPLETENESS);
      if (!error && data) {
        for (const row of data as CanonicalRaceRow[]) merged.set(row.id, raceRowToDomain(row));
      }
    }
    if (seriesIds.size > 0) {
      const { data, error } = await supabase
        .from(RACES)
        .select("*")
        .in("series_id", [...seriesIds])
        .eq("status", "active")
        .gte("completeness_score", MIN_ACTIVE_SEARCH_COMPLETENESS)
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(120);
      if (!error && data) {
        for (const row of data as CanonicalRaceRow[]) merged.set(row.id, raceRowToDomain(row));
      }
    }
  } catch (e) {
    runfolioLog.warn("canonical.repo.searchActive.alias", e instanceof Error ? e.message : String(e));
  }

  let rows = [...merged.values()];
  rows = applyPassiveSearchFilters(rows, filters);
  rows.sort((a, b) => {
    const ad = a.startDate ?? "";
    const bd = b.startDate ?? "";
    if (ad !== bd) return bd.localeCompare(ad);
    return a.name.localeCompare(b.name);
  });
  return { ok: true, data: rows.slice(0, resultLimit) };
}

export async function searchCanonicalRacesActive(
  filters: CanonicalSearchFilters
): Promise<RepositoryResult<CanonicalRace[]>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const limit = Math.min(filters.limit ?? 40, 100);
  const qText = filters.query?.trim() ?? "";
  if (qText.length >= 2) {
    return searchCanonicalRacesWithTextQuery(supabase, filters, limit);
  }

  let query = supabase
    .from(RACES)
    .select("*")
    .eq("status", "active")
    .gte("completeness_score", MIN_ACTIVE_SEARCH_COMPLETENESS)
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (filters.country?.trim()) {
    query = query.ilike("country", `%${filters.country.trim()}%`);
  }
  if (filters.city?.trim()) {
    query = query.ilike("city", `%${filters.city.trim()}%`);
  }
  if (filters.trailOnly) {
    query = query.eq("is_trail", true);
  }
  if (filters.ultraOnly) {
    query = query.eq("is_ultra", true);
  }
  if (filters.distanceMinKm != null) {
    query = query.gte("distance_km", filters.distanceMinKm);
  }
  if (filters.distanceMaxKm != null) {
    query = query.lte("distance_km", filters.distanceMaxKm);
  }
  if (filters.dateFrom?.trim()) {
    query = query.gte("start_date", filters.dateFrom.trim());
  }
  if (filters.dateTo?.trim()) {
    query = query.lte("start_date", filters.dateTo.trim());
  }

  const { data, error } = await query;
  if (error) {
    runfolioLog.warn("canonical.repo.searchActive", error.message);
    return { ok: false, error: error.message };
  }
  const rows = (data as CanonicalRaceRow[]).map(raceRowToDomain);
  return { ok: true, data: rows };
}
