"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  hideRaceFromProfileAction,
  publishRaceToProfileAction,
  setRaceProfileFeaturedAction
} from "@/lib/actions";
import { Button } from "@/components/ui/button";

type Props = {
  raceId: string;
  isPublished: boolean;
  isFeatured: boolean;
};

export function ProfileRaceCurationToolbar({ raceId, isPublished, isFeatured }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
      {!isPublished ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              await publishRaceToProfileAction(fd);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="race_id" value={raceId} />
          <Button
            type="submit"
            disabled={pending}
            className="bg-gold/90 text-[10px] font-semibold uppercase tracking-wider text-black hover:bg-gold"
          >
            {pending ? "…" : "Show on profile"}
          </Button>
        </form>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                await setRaceProfileFeaturedAction(fd);
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="race_id" value={raceId} />
            <input type="hidden" name="profile_featured" value={isFeatured ? "false" : "true"} />
            <Button
              type="submit"
              variant="secondary"
              disabled={pending}
              className="border-white/25 bg-transparent text-[10px] font-semibold uppercase tracking-wider text-white/90"
            >
              {isFeatured ? "Unfeature" : "Feature"}
            </Button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                await hideRaceFromProfileAction(fd);
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="race_id" value={raceId} />
            <Button
              type="submit"
              variant="ghost"
              disabled={pending}
              className="text-[10px] text-white/55 hover:text-white/80"
            >
              Hide
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
