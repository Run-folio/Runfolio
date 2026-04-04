import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { SettingsClient } from "@/app/settings/settings-client";
import { getServerAuthUser } from "@/lib/auth-server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { userHasStravaCredentials } from "@/lib/strava-credentials-db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return <DataBackendSetupGate title="Settings" featureLabel="Settings" returnTo="/settings" />;
  }

  await requirePersistenceReadyOrRedirect("/settings");

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/settings")}`);
  }

  const supabase = await createClient();
  const stravaConnected = await userHasStravaCredentials(user.id);
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  const email = user.email ?? "";
  let displayName = (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "") || "";
  if (!displayName.trim()) {
    const { data: row } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
    displayName = (row as { name?: string } | null)?.name?.trim() ?? "";
  }

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c]">
        <SettingsClient
          email={email}
          displayName={displayName}
          stravaConnected={stravaConnected}
          stravaOAuthConfigured={stravaOAuthConfigured}
        />
      </main>
    </>
  );
}
