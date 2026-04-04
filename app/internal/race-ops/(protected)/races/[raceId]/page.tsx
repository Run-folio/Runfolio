import Link from "next/link";
import { notFound } from "next/navigation";
import { RaceOpsMatchProbe } from "@/components/race-ops/race-ops-match-probe";
import { CANONICAL_CURATION_LOCK_KEYS } from "@/lib/races/canonical/curation-meta";
import {
  getCanonicalRaceById,
  listCanonicalSeriesShort,
  listEditionAliasesForRace,
  listPortfolioRacesLinkedToCanonical,
  listSourcesForRace
} from "@/lib/races/canonical/repository";
import {
  raceOpsAddEditionAliasAction,
  raceOpsEnqueueEnrichmentAction,
  raceOpsMergeEditionsAction,
  raceOpsSaveCanonicalRaceAction,
  raceOpsUnlinkPortfolioRaceAction
} from "@/lib/races/internal/race-ops-actions";

type Props = { params: Promise<{ raceId: string }> };

function Field({
  label,
  name,
  defaultValue,
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
      />
    </div>
  );
}

function Area({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue: string; rows?: number }) {
  return (
    <div className="md:col-span-2">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
      />
    </div>
  );
}

export default async function RaceOpsRaceDetailPage({ params }: Props) {
  const { raceId } = await params;
  const res = await getCanonicalRaceById(raceId);
  if (!res.ok || !res.data) notFound();
  const r = res.data;

  const [src, aliases, series, portfolio] = await Promise.all([
    listSourcesForRace(raceId),
    listEditionAliasesForRace(raceId),
    listCanonicalSeriesShort(400),
    listPortfolioRacesLinkedToCanonical(raceId, 100)
  ]);

  const sources = src.ok ? src.data : [];
  const aliasRows = aliases.ok ? aliases.data : [];
  const seriesRows = series.ok ? series.data : [];
  const links = portfolio.ok ? portfolio.data : [];

  const locks = r.curationLocked;
  const verified = (r.curationMeta.verifiedFields ?? []).join(", ");
  const weak = (r.curationMeta.weakEnrichmentFields ?? []).join(", ");
  const notes = r.curationMeta.notes ?? "";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">{r.name}</h1>
          <p className="mt-1 font-mono text-[12px] text-white/50">{r.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/internal/race-ops/races" className="text-[12px] text-accent hover:underline">
            ← Search
          </Link>
          <Link href={`/races/${r.slug}`} className="text-[12px] text-white/45 hover:text-white/75" target="_blank">
            Public page →
          </Link>
        </div>
      </div>

      <section className="mt-10 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Edition fields &amp; locks</h2>
        <p className="mt-2 text-[12px] text-white/60">
          Checked locks prevent automated merges / enrichment from overwriting that field. Source rows are unchanged.
        </p>
        <form action={raceOpsSaveCanonicalRaceAction} className="mt-6 space-y-6">
          <input type="hidden" name="race_id" value={r.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Slug" name="slug" defaultValue={r.slug} />
            <Field label="Status" name="status" defaultValue={r.status} />
            <Field label="Name" name="name" defaultValue={r.name} />
            <Field label="Series ID (uuid or empty)" name="series_id" defaultValue={r.seriesId ?? ""} />
            <Field label="Start date" name="start_date" defaultValue={r.startDate ?? ""} />
            <Field label="End date" name="end_date" defaultValue={r.endDate ?? ""} />
            <Field label="Timezone" name="timezone" defaultValue={r.timezone ?? ""} />
            <Field label="Distance km" name="distance_km" defaultValue={r.distanceKm != null ? String(r.distanceKm) : ""} />
            <Field
              label="Distance options km (comma)"
              name="distance_options_km"
              defaultValue={r.distanceOptionsKm.join(", ")}
            />
            <Field label="Elevation gain m" name="elevation_gain_m" defaultValue={r.elevationGainM != null ? String(r.elevationGainM) : ""} />
            <Field label="Country" name="country" defaultValue={r.country ?? ""} />
            <Field label="Region" name="region" defaultValue={r.region ?? ""} />
            <Field label="City" name="city" defaultValue={r.city ?? ""} />
            <Field label="Venue" name="venue" defaultValue={r.venue ?? ""} />
            <Field label="Latitude" name="latitude" defaultValue={r.latitude != null ? String(r.latitude) : ""} />
            <Field label="Longitude" name="longitude" defaultValue={r.longitude != null ? String(r.longitude) : ""} />
            <Field label="Organizer" name="organizer_name" defaultValue={r.organizerName ?? ""} />
            <Field label="Official URL" name="official_url" defaultValue={r.officialUrl ?? ""} />
            <Field label="Registration URL" name="registration_url" defaultValue={r.registrationUrl ?? ""} />
            <Field label="Logo URL" name="logo_url" defaultValue={r.logoUrl ?? ""} />
            <Field label="Hero image URL" name="hero_image_url" defaultValue={r.heroImageUrl ?? ""} />
            <Field label="Fallback image URL" name="fallback_image_url" defaultValue={r.fallbackImageUrl ?? ""} />
            <Field label="Race type" name="race_type" defaultValue={r.raceType ?? ""} />
            <Field label="Surface" name="surface_type" defaultValue={r.surfaceType ?? ""} />
            <Area label="Short description" name="description" defaultValue={r.description ?? ""} rows={3} />
            <Area label="Long description" name="long_description" defaultValue={r.longDescription ?? ""} rows={5} />
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Category tags (comma)</label>
              <input
                name="category_tags"
                defaultValue={r.categoryTags.join(", ")}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Verified field keys (comma, camelCase e.g. name,startDate)
              </label>
              <input
                name="verified_fields"
                defaultValue={verified}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Weak auto-enrichment fields (comma)</label>
              <input
                name="weak_enrichment_fields"
                defaultValue={weak}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <Area label="Ops notes" name="curation_notes" defaultValue={notes} rows={2} />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Curation locks</p>
            <div className="mt-2 grid max-h-48 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto text-[12px] sm:grid-cols-3">
              {CANONICAL_CURATION_LOCK_KEYS.map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-white/80">
                  <input type="checkbox" name={`lock_${key}`} defaultChecked={locks[key] === true} className="rounded border-white/30" />
                  {key}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-accent px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white"
          >
            Save edition
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Series quick pick</h2>
        <p className="mt-1 text-[12px] text-white/55">Copy a series UUID into the field above, save, and optionally lock seriesId.</p>
        <ul className="mt-3 max-h-36 overflow-y-auto text-[11px] text-white/65">
          {seriesRows.slice(0, 80).map((s) => (
            <li key={s.id}>
              <span className="font-mono text-white/45">{s.id.slice(0, 8)}…</span> {s.name} ({s.slug})
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Enrichment</h2>
        <p className="mt-1 text-[12px] text-white/55">
          Status: <strong className="text-white/80">{r.enrichmentStatus}</strong>
          {r.lastEnrichedAt ? ` · last ${r.lastEnrichedAt}` : ""}
        </p>
        <form action={raceOpsEnqueueEnrichmentAction} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="race_id" value={r.id} />
          <button
            type="submit"
            className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-sky-100"
          >
            Re-queue enrichment job
          </button>
        </form>
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] text-white/55">enrichment_meta (JSON)</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-white/10 bg-black/50 p-2 text-[10px] text-white/70">
            {JSON.stringify(r.enrichmentMeta, null, 2)}
          </pre>
        </details>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Provider sources (read-only)</h2>
        {!src.ok ? <p className="mt-2 text-sm text-rose-300">{src.error}</p> : null}
        <ul className="mt-3 space-y-3 text-[12px]">
          {sources.map((s) => (
            <li key={s.id} className="rounded border border-white/10 bg-black/30 p-3">
              <p className="font-medium text-white/85">
                {s.source} · {s.sourceRaceId}
              </p>
              <p className="text-white/50">{s.sourceUrl ?? "—"}</p>
              <p className="mt-1 text-[10px] text-white/40">Synced {s.lastSyncedAt ?? "—"}</p>
            </li>
          ))}
          {sources.length === 0 ? <li className="text-white/45">No source rows.</li> : null}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Edition aliases</h2>
        <ul className="mt-2 text-[12px] text-white/70">
          {aliasRows.map((a) => (
            <li key={a.id}>
              {a.alias_text} <span className="text-white/40">({a.kind})</span>
            </li>
          ))}
          {aliasRows.length === 0 ? <li className="text-white/45">None.</li> : null}
        </ul>
        <form action={raceOpsAddEditionAliasAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="race_id" value={r.id} />
          <div>
            <label className="text-[10px] uppercase text-muted">New alias</label>
            <input name="alias_text" className="mt-1 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted">Kind</label>
            <select name="alias_kind" className="mt-1 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm">
              <option value="variant">variant</option>
              <option value="official">official</option>
              <option value="short">short</option>
              <option value="abbrev">abbrev</option>
              <option value="alt_spelling">alt_spelling</option>
            </select>
          </div>
          <button type="submit" className="rounded bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase">
            Add
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-amber-500/20 bg-amber-950/20 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Merge duplicate edition</h2>
        <p className="mt-2 text-[12px] text-white/65">
          Moves <code className="rounded bg-black/40 px-1">canonical_race_sources</code>, edition aliases, portfolio{" "}
          <code className="rounded bg-black/40 px-1">canonical_race_id</code>, and bucket goals from the loser into{" "}
          <strong className="text-white/85">this</strong> row. Loser is hidden and slug renamed.
        </p>
        <form action={raceOpsMergeEditionsAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="keep_id" value={r.id} />
          <div>
            <label className="text-[10px] uppercase text-muted">Loser race UUID</label>
            <input
              name="remove_id"
              placeholder="uuid to fold in"
              className="mt-1 w-72 rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-amber-700 px-4 py-2 text-[11px] font-semibold uppercase text-white">
            Merge into this edition
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Portfolio links (manual unlink)</h2>
        <p className="mt-1 text-[12px] text-white/55">Clears <code className="rounded bg-black/30 px-1">races.canonical_race_id</code> only.</p>
        {!portfolio.ok ? <p className="text-rose-300">{portfolio.error}</p> : null}
        <ul className="mt-3 space-y-2 text-[12px]">
          {links.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2">
              <span>
                {row.name}{" "}
                <span className="font-mono text-[10px] text-white/40">{row.id}</span>
              </span>
              <form action={raceOpsUnlinkPortfolioRaceAction}>
                <input type="hidden" name="portfolio_race_id" value={row.id} />
                <input type="hidden" name="canonical_race_id" value={r.id} />
                <button type="submit" className="text-[11px] text-rose-300 hover:underline">
                  Unlink canonical
                </button>
              </form>
            </li>
          ))}
          {links.length === 0 ? <li className="text-white/45">No portfolio races point at this edition.</li> : null}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Match probe</h2>
        <p className="mt-1 text-[12px] text-white/55">
          Uses <code className="rounded bg-black/30 px-1">scoreActivityAgainstCanonical</code> — same signal breakdown as product matchers.
        </p>
        <RaceOpsMatchProbe raceId={r.id} />
      </section>

      <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Scores &amp; flags</h2>
        <p className="text-[12px] text-white/70">
          Quality {r.qualityScore} · Completeness {r.completenessScore}
        </p>
        <pre className="mt-2 max-h-32 overflow-auto text-[11px] text-white/55">
          {JSON.stringify(r.qualityFlags, null, 2)}
        </pre>
      </section>
    </main>
  );
}
