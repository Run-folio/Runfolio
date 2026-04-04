import { runfolioLog } from "@/lib/runfolio-log";

/**
 * Strava API v3 rate-limit headers (see https://developers.strava.com/docs/rate-limits/):
 * - X-RateLimit-Limit / X-RateLimit-Usage — overall quota: "15minLimit,dailyLimit" and "15minUsage,dailyUsage"
 * - X-ReadRateLimit-Limit / X-ReadRateLimit-Usage — read (non-upload) endpoints, same comma shape
 * List activities (`GET /athlete/activities`) counts against the read bucket when Strava sends it.
 */

export type StravaRateLimitKind = "short_window" | "daily" | "unknown";

export type StravaRateLimitBuckets = {
  used15: number;
  limit15: number;
  usedDay: number;
  limitDay: number;
};

export type Strava429Classification = {
  kind: StravaRateLimitKind;
  /** Primary user-facing line (stored in ingest `last_error`). */
  userMessage: string;
  /** When we suggest the user can retry (ISO UTC). */
  untilIso: string | null;
  read: StravaRateLimitBuckets | null;
  overall: StravaRateLimitBuckets | null;
  retryAfterSec: number | null;
  /** Short machine reason for logs. */
  inferReason: string;
};

const MSG_SHORT =
  "Strava short-window limit reached — try again at the next 15-minute window.";
const MSG_DAILY = "Strava daily limit reached — try again after midnight UTC.";
const MSG_UNKNOWN = "Strava rate limited — retry later.";

function headerCI(headers: Record<string, string>, canonicalName: string): string | undefined {
  const want = canonicalName.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return undefined;
}

/** Strava sends two comma-separated numbers in each header: 15-minute window first, daily second. */
export function parseStravaLimitUsageHeaders(
  usageRaw: string | undefined,
  limitRaw: string | undefined
): StravaRateLimitBuckets | null {
  const u = usageRaw?.trim().split(",") ?? [];
  const l = limitRaw?.trim().split(",") ?? [];
  if (u.length < 2 || l.length < 2) return null;
  const used15 = Number(u[0].trim());
  const usedDay = Number(u[1].trim());
  const limit15 = Number(l[0].trim());
  const limitDay = Number(l[1].trim());
  if (![used15, usedDay, limit15, limitDay].every((n) => Number.isFinite(n))) return null;
  return { used15, limit15, usedDay, limitDay };
}

function extractBuckets(headers: Record<string, string>): {
  read: StravaRateLimitBuckets | null;
  overall: StravaRateLimitBuckets | null;
} {
  const read = parseStravaLimitUsageHeaders(
    headerCI(headers, "X-ReadRateLimit-Usage"),
    headerCI(headers, "X-ReadRateLimit-Limit")
  );
  const overall = parseStravaLimitUsageHeaders(
    headerCI(headers, "X-RateLimit-Usage"),
    headerCI(headers, "X-RateLimit-Limit")
  );
  return { read, overall };
}

function classifyFromBucket(
  b: StravaRateLimitBuckets,
  label: string
): { kind: StravaRateLimitKind; reason: string } | null {
  if (b.limit15 > 0 && b.used15 >= b.limit15) {
    return { kind: "short_window", reason: `${label}_15m_exhausted` };
  }
  if (b.limitDay > 0 && b.usedDay >= b.limitDay) {
    return { kind: "daily", reason: `${label}_daily_exhausted` };
  }
  return null;
}

function nextUtcMidnightIso(): string {
  const d = new Date();
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

function shortWindowUntilIso(retryAfterSec: number | null): string {
  const fifteenMin = 15 * 60;
  const ra = retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : fifteenMin;
  const sec = Math.min(Math.max(ra, 60), 24 * 3600);
  return new Date(Date.now() + sec * 1000).toISOString();
}

/**
 * Classify a 429 on a Strava list (or other) call using response headers and optional Retry-After.
 */
export function classifyStrava429FromHeaders(
  rateLimitHeaders: Record<string, string>,
  retryAfterSec: number | null
): Strava429Classification {
  const { read, overall } = extractBuckets(rateLimitHeaders);

  const tryOrder: { b: StravaRateLimitBuckets | null; label: string }[] = [
    { b: read, label: "read" },
    { b: overall, label: "overall" }
  ];

  for (const { b, label } of tryOrder) {
    if (!b) continue;
    const hit = classifyFromBucket(b, label);
    if (hit) {
      const untilIso =
        hit.kind === "daily"
          ? nextUtcMidnightIso()
          : shortWindowUntilIso(retryAfterSec);
      return {
        kind: hit.kind,
        userMessage: hit.kind === "daily" ? MSG_DAILY : MSG_SHORT,
        untilIso,
        read,
        overall,
        retryAfterSec,
        inferReason: hit.reason
      };
    }
  }

  if (retryAfterSec != null && retryAfterSec >= 3600) {
    return {
      kind: "daily",
      userMessage: MSG_DAILY,
      untilIso: nextUtcMidnightIso(),
      read,
      overall,
      retryAfterSec,
      inferReason: "retry_after_ge_3600"
    };
  }

  if (retryAfterSec != null && retryAfterSec >= 120) {
    return {
      kind: "short_window",
      userMessage: MSG_SHORT,
      untilIso: shortWindowUntilIso(retryAfterSec),
      read,
      overall,
      retryAfterSec,
      inferReason: "retry_after_short_heuristic"
    };
  }

  return {
    kind: "unknown",
    userMessage: MSG_UNKNOWN,
    untilIso: retryAfterSec != null && retryAfterSec > 0 ? shortWindowUntilIso(retryAfterSec) : null,
    read,
    overall,
    retryAfterSec,
    inferReason: "unknown_no_bucket_match"
  };
}

export function logStrava429Classification(
  scope: string,
  meta: {
    userId?: string;
    firstEndpoint?: string;
    httpStatus: number;
    classification: Strava429Classification;
  }
): void {
  const c = meta.classification;
  runfolioLog.info(scope, "strava_429_classified", {
    userId: meta.userId,
    firstEndpoint: meta.firstEndpoint,
    httpStatus: meta.httpStatus,
    kind: c.kind,
    inferReason: c.inferReason,
    untilIso: c.untilIso,
    retryAfterSec: c.retryAfterSec,
    readBucket:
      c.read != null
        ? `${c.read.used15}/${c.read.limit15};day ${c.read.usedDay}/${c.read.limitDay}`
        : undefined,
    overallBucket:
      c.overall != null
        ? `${c.overall.used15}/${c.overall.limit15};day ${c.overall.usedDay}/${c.overall.limitDay}`
        : undefined
  });
}
