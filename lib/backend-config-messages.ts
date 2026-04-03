/** User-facing when env / demo mode blocks the real database. */
export const BACKEND_NOT_CONNECTED_USER_MESSAGE =
  "Runfolio isn’t connected to your database. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) to .env.local, run the SQL migrations in /supabase on your project, restart the dev server, and sign in again. If RUNFOLIO_OFFLINE_DEMO=1 is set, remove it for live saves.";

/** Shorter copy for inline errors on save buttons / server action results. */
export const BACKEND_SAVE_FAILED_SHORT =
  "Couldn’t save — database not connected. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, apply migrations, restart the server, and try again.";
