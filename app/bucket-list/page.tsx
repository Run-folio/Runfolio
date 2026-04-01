import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { demoRaces, isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";

export const dynamic = "force-dynamic";

export default async function BucketListPage() {
  let races = demoRaces;
  if (isSupabaseConfigured()) {
    try {
      const { user, authError } = await getServerAuthUser();
      if (authError) throw new Error(authError);
      if (!user) redirect("/auth/login");
      const supabase = await createClient();
      const result = await supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false });
      if (result.error) {
        runfolioLog.warn("BucketList.races", result.error.message ?? "query error");
        races = [];
      } else {
        races = result.data ?? [];
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      if (isRedirectError(e)) throw e;
      runfolioLog.error("BucketList.supabase", e);
      races = demoRaces;
    }
  }
  const completed = (races ?? []).filter((race) => race.is_completed);
  const future = (races ?? []).filter((race) => !race.is_completed);

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[280px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/reference/hero-1.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[280px] flex-col justify-end pb-12">
          <p className="type-eyebrow">Bucket List</p>
          <h1 className="type-display mt-3 max-w-3xl">Races that define your journey</h1>
          <p className="type-meta mt-4 max-w-2xl">Completed dreams beside future start lines.</p>
        </div>
      </section>

      <main className="app-shell space-y-10">
        <div className="flex flex-col gap-4 border border-border bg-panel/80 p-4 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <Input placeholder="Search races to add" className="max-w-xl" />
          <Button>Add custom race</Button>
        </div>

        <section className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Completed Races</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((race) => (
              <Card key={race.id} className="bg-panelAlt/90">
                <p className="font-semibold uppercase tracking-[0.04em]">{race.name}</p>
                <p className="type-meta mt-2 text-sm">
                  {race.distance_km ?? "-"} km · {race.location ?? "Unknown"} · {race.date ?? "TBD"}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Future Goals</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {future.map((race) => (
              <Card key={race.id} className="bg-panelAlt/90">
                <p className="font-semibold uppercase tracking-[0.04em]">{race.name}</p>
                <p className="type-meta mt-2 text-sm">
                  {race.distance_km ?? "-"} km · {race.location ?? "Unknown"} · {race.date ?? "TBD"}
                </p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
