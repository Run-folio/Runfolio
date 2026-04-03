/**
 * Safe incremental series / series_id / alias backfill for canonical catalog.
 * Default: dry-run. Pass --apply to write. Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 *
 * Usage:
 *   npx tsx scripts/canonical-series-backfill.ts
 *   npx tsx scripts/canonical-series-backfill.ts --apply --run-id=batch-2026-04-02-a
 *   npx tsx scripts/canonical-series-backfill.ts --apply --max-new-series 25 --max-groups 50
 *   npx tsx scripts/canonical-series-backfill.ts --json
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { runSeriesBackfillWorkflow, type RunSeriesBackfillOptions } from "@/lib/races/canonical/series-backfill/workflow";

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
  const verbose = hasFlag("--verbose", argv);

  const runId = argValue("--run-id", argv) ?? `backfill-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;
  const maxNewSeriesRaw = argValue("--max-new-series", argv);
  const maxGroupsRaw = argValue("--max-groups", argv);
  const minEditions = Number(argValue("--min-editions", argv) ?? "2");
  const minYears = Number(argValue("--min-distinct-years", argv) ?? "2");
  const spread = Number(argValue("--max-distance-spread", argv) ?? "0.12");

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

  const opts: RunSeriesBackfillOptions = {
    dryRun: !apply,
    minEditions: Number.isFinite(minEditions) ? minEditions : 2,
    minDistinctYears: Number.isFinite(minYears) ? minYears : 2,
    maxDistanceSpreadRatio: Number.isFinite(spread) ? spread : 0.12,
    backfillRunId: runId,
    maxNewSeries: maxNewSeriesRaw ? Number(maxNewSeriesRaw) : undefined,
    maxGroups: maxGroupsRaw ? Number(maxGroupsRaw) : undefined
  };

  if (!apply) {
    console.error("Dry-run mode (no DB writes). Pass --apply to execute.\n");
  }

  const result = await runSeriesBackfillWorkflow(client, opts);

  if (json) {
    console.log(JSON.stringify({ opts, ...result }, null, 2));
    return;
  }

  console.log("Summary:");
  console.log(JSON.stringify(result.summary, null, 2));
  if (verbose) {
    console.log("\nLogs:");
    for (const line of result.logs) {
      console.log(JSON.stringify(line));
    }
  } else {
    console.log(`\n(${result.logs.length} log lines; use --verbose or --json for full detail)\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
