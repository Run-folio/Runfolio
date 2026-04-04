import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

const JOBS = "canonical_enrichment_jobs";

export type EnrichmentJobRow = {
  id: string;
  race_id: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_for: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  payload: Record<string, unknown>;
};

function noClient(): { ok: false; error: string } {
  return { ok: false, error: "Service role not configured." };
}

/**
 * Queue background enrichment for many editions. Skips races that already have an active job.
 */
export async function enqueueCanonicalEnrichmentJobs(
  raceIds: string[],
  priority = 0
): Promise<{ ok: true; enqueued: number; skipped: number } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  if (!supabase) return noClient();
  const now = new Date().toISOString();
  let enqueued = 0;
  let skipped = 0;
  for (const id of raceIds) {
    const rid = id.trim();
    if (!rid) continue;
    const { error } = await supabase.from(JOBS).insert({
      race_id: rid,
      status: "queued",
      priority,
      scheduled_for: now,
      payload: {}
    });
    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      runfolioLog.warn("enrichmentJobs.enqueue", error.message, { raceId: rid });
      return { ok: false, error: error.message };
    }
    enqueued += 1;
    await supabase.from("canonical_races").update({ enrichment_status: "queued", updated_at: now }).eq("id", rid);
  }
  return { ok: true, enqueued, skipped };
}

/**
 * Atomically claim one job (queued, due). Returns null if none.
 */
export async function claimNextEnrichmentJob(): Promise<EnrichmentJobRow | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const now = new Date().toISOString();

  const { data: peek, error: selErr } = await supabase
    .from(JOBS)
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr || !peek) return null;

  const row = peek as EnrichmentJobRow;
  const { data: claimed, error: updErr } = await supabase
    .from(JOBS)
    .update({ status: "running", started_at: now })
    .eq("id", row.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (updErr || !claimed) return null;
  return claimed as EnrichmentJobRow;
}

export async function finishEnrichmentJob(
  jobId: string,
  status: "done" | "failed" | "skipped",
  opts?: { error?: string; bumpAttempts?: boolean; retryAfterSec?: number }
): Promise<void> {
  const supabase = createServiceRoleClient();
  if (!supabase) return;
  const now = new Date().toISOString();

  const { data: job } = await supabase.from(JOBS).select("attempts, max_attempts, race_id").eq("id", jobId).single();
  const j = job as { attempts: number; max_attempts: number; race_id: string } | null;

  if (status === "failed" && opts?.bumpAttempts !== false && j) {
    const nextAttempts = j.attempts + 1;
    if (nextAttempts < j.max_attempts && opts?.retryAfterSec) {
      const retryAt = new Date(Date.now() + opts.retryAfterSec * 1000).toISOString();
      await supabase
        .from(JOBS)
        .update({
          status: "queued",
          attempts: nextAttempts,
          last_error: opts?.error ?? "error",
          scheduled_for: retryAt,
          started_at: null,
          finished_at: null
        })
        .eq("id", jobId);
      return;
    }
  }

  await supabase
    .from(JOBS)
    .update({
      status,
      last_error: status === "failed" ? opts?.error ?? "failed" : null,
      finished_at: now
    })
    .eq("id", jobId);
}
