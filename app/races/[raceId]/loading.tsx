import { AppNavbar } from "@/components/app-navbar";

export default function RaceDetailLoading() {
  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] px-5 pb-20 pt-10 md:px-8">
        <div className="app-shell mx-auto max-w-[1200px] animate-pulse space-y-8">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="aspect-[21/9] min-h-[200px] w-full rounded-2xl bg-white/5 md:min-h-[280px]" />
          <div className="h-12 max-w-xl rounded bg-white/10" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-28 rounded-2xl bg-white/5" />
            <div className="h-28 rounded-2xl bg-white/5" />
            <div className="h-28 rounded-2xl bg-white/5" />
            <div className="h-28 rounded-2xl bg-white/5" />
          </div>
          <div className="h-40 rounded-2xl bg-white/5" />
        </div>
      </main>
    </>
  );
}
