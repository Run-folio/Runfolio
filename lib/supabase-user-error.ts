import { runfolioLog } from "@/lib/runfolio-log";

type SupabaseLikeError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** PostgREST: relation not exposed / not in schema cache. Postgres: undefined_table */
export function isSupabaseMissingSchemaError(e: Pick<SupabaseLikeError, "message" | "code">): boolean {
  const msg = e.message ?? "";
  const code = e.code ?? "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /could not find the table/i.test(msg) ||
    (/schema cache/i.test(msg) && /public\./i.test(msg)) ||
    /relation\s+["']?public\.\w+["']?\s+does not exist/i.test(msg)
  );
}

/** Log missing-table / schema cache issues at error level with codes for ops. */
export function logSupabaseSchemaIssue(scope: string, e: SupabaseLikeError): void {
  if (!isSupabaseMissingSchemaError(e)) return;
  const table = extractMissingTableName(e.message);
  runfolioLog.error(scope, e.message, {
    code: e.code,
    table,
    hint: e.hint,
    fix: "Run /supabase/schema.sql then migration_*.sql in Supabase SQL editor (see migration_auth_users_sync.sql header for order)"
  });
}

function extractMissingTableName(message: string): string | undefined {
  const m = message.match(/public\.(\w+)/i);
  return m?.[1];
}

/**
 * Turn raw PostgREST/Postgres messages into actionable copy when tables are missing.
 */
export function clarifySupabaseError(e: SupabaseLikeError): string {
  if (isSupabaseMissingSchemaError(e)) {
    const table = extractMissingTableName(e.message);
    const focus = table ? `The table public.${table} is not in your database yet` : "A required table is missing in your database";
    return `${focus} (Supabase schema not applied). Open the Supabase SQL editor for this project and run the SQL files from the repo’s supabase/ folder in order — start with schema.sql, then each migration_*.sql file (see the numbered list in supabase/migration_auth_users_sync.sql). After that, reload the app and try again.`;
  }
  return e.message;
}
