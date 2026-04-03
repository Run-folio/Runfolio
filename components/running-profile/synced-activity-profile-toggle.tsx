"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSyncedActivityProfileIncludeAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

type Props = {
  stravaActivityId: string;
  included: boolean;
};

export function SyncedActivityProfileToggle({ stravaActivityId, included }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex items-center justify-between gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await setSyncedActivityProfileIncludeAction(fd);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="strava_activity_id" value={stravaActivityId} />
      <input type="hidden" name="profile_include" value={included ? "false" : "true"} />
      <span className="text-[10px] text-white/50">{included ? "On your profile" : "Not on profile"}</span>
      <Button type="submit" variant="ghost" disabled={pending} className="px-2 py-1 text-[10px] uppercase tracking-wider">
        {pending ? "…" : included ? "Remove" : "Pin"}
      </Button>
    </form>
  );
}
