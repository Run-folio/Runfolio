/**
 * Ingest curated UTMB World Series–style races into canonical_race_series + canonical_races + aliases.
 * Default: dry-run. Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 *
 * Data source: bundled `UTMB_WORLD_SERIES_RECORDS`, or JSON array from UTMB_INGEST_JSON_PATH.
 *
 * Usage:
 *   npx tsx scripts/utmb-canonical-ingest.ts
 *   npx tsx scripts/utmb-canonical-ingest.ts --apply
 *   UTMB_INGEST_JSON_PATH=./data/utmb-extra.json npx tsx scripts/utmb-canonical-ingest.ts --apply
 *   npx tsx scripts/utmb-canonical-ingest.ts --apply --year-from 2023 --year-to 2027 --json
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { defaultUtmbIngestOptions, runUtmbCanonicalIngest } from "@/lib/races/utmb-ingest/pipeline";

function argValue(name: string, argv: string[]): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function hasFlag(name: string, argv: string[]): boolean {
  return argv.includes(name);
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = hasFlag("--apply", argv);
  const json = hasFlag("--json", argv);

  const refYear = Number(argValue("--ref-year", argv) ?? new Date().getUTCFullYear());
  const yFrom = argValue("--year-from", argv);
  const yTo = argValue("--year-to", argv);
  const defaults = defaultUtmbIngestOptions(Number.isFinite(refYear) ? refYear : new Date().getUTCFullYear());

  const yearFrom = yFrom != null ? Number(yFrom) : defaults.yearFrom;
  const yearTo = yTo != null ? Number(yTo) : defaults.yearTo;

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in environment or .env.local before running)."
    );
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (!apply) {
    console.error("Dry-run mode (no DB writes). Pass --apply to execute.\n");
  }

  const { summary, loadErrors } = await runUtmbCanonicalIngest(client, {
    dryRun: !apply,
    yearFrom: Number.isFinite(yearFrom) ? yearFrom : defaults.yearFrom,
    yearTo: Number.isFinite(yearTo) ? yearTo : defaults.yearTo,
    skipUnchangedPayload: true
  });

  if (json) {
    console.log(JSON.stringify({ loadErrors, summary }, null, 2));
    return;
  }

  console.log("UTMB canonical ingest summary:");
  console.log(JSON.stringify(summary, null, 2));
  if (loadErrors.length) {
    console.error("\nLoad warnings/errors:");
    for (const e of loadErrors) console.error(`  - ${e}`);
  }
  if (summary.validationErrors.length) {
    console.error("\nValidation / run messages (first 40):");
    for (const e of summary.validationErrors.slice(0, 40)) console.error(`  - ${e}`);
    if (summary.validationErrors.length > 40) {
      console.error(`  ... and ${summary.validationErrors.length - 40} more`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
