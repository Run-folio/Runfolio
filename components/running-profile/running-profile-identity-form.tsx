"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileIdentityAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

type Props = {
  initialTagline: string;
  initialLocation: string;
  initialPublic: boolean;
};

export function RunningProfileIdentityForm({ initialTagline, initialLocation, initialPublic }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [profilePublic, setProfilePublic] = useState(initialPublic);

  return (
    <form
      className="mt-6 space-y-4 border border-white/10 bg-black/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await updateProfileIdentityAction(fd);
          router.refresh();
        });
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Public profile copy</p>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Tagline</span>
        <input
          name="profile_tagline"
          defaultValue={initialTagline}
          placeholder="A line about how you run"
          className="mt-1 w-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Location</span>
        <input
          name="profile_location"
          defaultValue={initialLocation}
          placeholder="City, region"
          className="mt-1 w-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
      </label>
      <input type="hidden" name="profile_public" value={profilePublic ? "true" : "false"} />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-white/75">
        <input type="checkbox" checked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} />
        Profile visible to visitors
      </label>
      <Button type="submit" disabled={pending} variant="secondary" className="text-xs">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
