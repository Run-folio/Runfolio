import Image from "next/image";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { formatStravaMovingTime } from "@/lib/strava-api";
import { firstPhotoUrlFromSyncedPhotos } from "@/lib/running-profile/activity-photo";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { SyncedActivityProfileToggle } from "@/components/running-profile/synced-activity-profile-toggle";

type Props = {
  activities: StravaSyncedActivityRow[];
  isOwner?: boolean;
};

export function RunningProfileSelectedEfforts({ activities, isOwner }: Props) {
  if (activities.length === 0 && !isOwner) return null;

  return (
    <section className="border-x border-b border-border bg-[#05060a] px-5 py-10 md:px-8 md:py-12">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Selected efforts</p>
      <h2 className="font-display mt-2 text-xl font-normal text-white md:text-2xl">Runs you chose to remember</h2>
      <p className="type-meta mt-2 max-w-xl text-xs text-white/50">
        A short list — not your full training log. Approve standout days from synced Strava on your dashboard.
      </p>
      {activities.length === 0 ? (
        <p className="type-meta mt-8 text-sm text-white/45">
          No pinned efforts yet. Sync Strava, then mark activities from the dashboard.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((row) => {
            const photo = firstPhotoUrlFromSyncedPhotos(row.photos);
            const src = photo ?? getRaceSceneImagePath(row.name);
            const dist = row.distance_km ?? (row.distance_m != null ? row.distance_m / 1000 : null);
            const when = String(row.start_date).slice(0, 10);
            const place = [row.city, row.country].filter(Boolean).join(", ");
            const timeLabel =
              row.moving_time_sec != null ? formatStravaMovingTime(row.moving_time_sec) : "—";

            return (
              <li
                key={row.strava_activity_id}
                className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0d12]"
              >
                <div className="relative aspect-[5/3] w-full">
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 100vw, 33vw"
                    unoptimized={Boolean(photo)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-white">{row.name}</p>
                    <p className="mt-1 text-[10px] text-white/60">
                      {when} · {dist != null ? `${Math.round(dist * 10) / 10} km` : "—"} · {timeLabel}
                    </p>
                    {place ? <p className="mt-0.5 text-[10px] text-white/45">{place}</p> : null}
                  </div>
                </div>
                {isOwner ? (
                  <div className="border-t border-white/10 px-3 py-2">
                    <SyncedActivityProfileToggle
                      stravaActivityId={row.strava_activity_id}
                      included={Boolean(row.profile_include)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
