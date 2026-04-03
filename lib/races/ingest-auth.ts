/**
 * Optional shared secret for ingestion HTTP routes (cron / admin).
 * If `RACES_INGEST_SECRET` is set, callers must send `x-runfolio-ingest-secret: <value>`.
 */
export function verifyIngestRequest(req: Request): boolean {
  const secret = process.env.RACES_INGEST_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("x-runfolio-ingest-secret") === secret;
}
