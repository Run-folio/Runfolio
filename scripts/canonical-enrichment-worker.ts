/**
 * Drain `canonical_enrichment_jobs` by fetching official pages and merging enrichment.
 *
 * Usage:
 *   npx tsx scripts/canonical-enrichment-worker.ts --limit 10
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` (and Supabase URL). Run from cron every 5–15 min for steady progress.
 */
import { claimNextEnrichmentJob, finishEnrichmentJob } from "@/lib/races/canonical/enrichment-jobs";
import { runCanonicalRaceEnrichment } from "@/lib/races/canonical/enrichment/run-enrichment";

function argN(name: string, def: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || !process.argv[idx + 1]) return def;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) ? n : def;
}

async function main() {
  const limit = Math.max(1, Math.min(argN("--limit", 25), 500));
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await claimNextEnrichmentJob();
    if (!job) break;
    const res = await runCanonicalRaceEnrichment(job.race_id);
    processed += 1;
    if (res.ok && res.action === "enriched") {
      await finishEnrichmentJob(job.id, "done");
    } else if (res.ok && res.action === "skipped") {
      await finishEnrichmentJob(job.id, "skipped");
    } else {
      await finishEnrichmentJob(job.id, "failed", {
        error: !res.ok ? res.error : "enrichment_failed",
        retryAfterSec: 3600
      });
    }
  }
  // eslint-disable-next-line no-console -- CLI
  console.log(`canonical-enrichment-worker: processed ${processed} job(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
