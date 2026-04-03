import type { RunningProfileStats } from "@/lib/running-profile/stats";

type Props = {
  stats: RunningProfileStats;
};

export function RunningProfileStatsRow({ stats }: Props) {
  const items = [
    { label: "Races", value: stats.racesCompleted },
    { label: "Distance", value: `${stats.totalDistanceKm.toLocaleString()} km` },
    { label: "Vert", value: `${stats.totalElevationM.toLocaleString()} m` },
    { label: "Ultras", value: stats.ultraFinishes },
    { label: "Places", value: stats.countriesRaced }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm md:border-white/15"
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">{item.label}</p>
          <p className="mt-1.5 font-display text-xl font-normal text-white md:text-2xl">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
