import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { ActivityFileImportPanel } from "@/components/activity-file-import-panel";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import activity file · Runfolio",
  description: "Upload FIT, GPX, or TCX files to add race efforts without Strava. Saved activities use Match & Import."
};

export default async function ImportActivityFilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate
        title="Import activity file"
        featureLabel="File-based activity import"
        returnTo="/import/activity-file"
      />
    );
  }

  await requirePersistenceReadyOrRedirect("/import/activity-file");

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/import/activity-file")}`);
  }

  const supabase = await createClient();
  await ensurePublicUserRowForAuthedRequest(supabase, user);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <div className="app-shell mx-auto max-w-[720px] px-5 py-10 md:px-8 md:py-14">
          <ActivityFileImportPanel />
          <p className="type-meta mt-10 text-center text-[11px] leading-relaxed text-white/45">
            Prefer Strava?{" "}
            <Link href="/import/past-races" className="font-semibold text-accent underline-offset-4 hover:underline">
              Import past race efforts
            </Link>{" "}
            ·{" "}
            <Link href="/matches" className="font-semibold text-accent underline-offset-4 hover:underline">
              Match &amp; import
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
