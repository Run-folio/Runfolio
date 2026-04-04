"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  className?: string;
};

export function ActivityFileImportPanel({ className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile() {
    if (pending) return;
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || pending) return;
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      let res: Response;
      try {
        res = await fetch("/api/activities/import-file", {
          method: "POST",
          body: fd
        });
      } catch {
        setErr("Network error — try again.");
        return;
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        setErr("Unexpected server response.");
        return;
      }
      const o = body as {
        ok?: boolean;
        error?: string;
        strava_activity_id?: string;
        warnings?: string[];
        code?: string;
      };
      if (!res.ok || !o.ok) {
        setErr(o.error ?? "Import failed.");
        return;
      }
      if (o.strava_activity_id) {
        router.push(`/activities/${encodeURIComponent(o.strava_activity_id)}`);
        router.refresh();
        return;
      }
      const w = (o.warnings ?? []).filter(Boolean);
      setMsg(
        w.length
          ? `Imported. ${w.join(" ")} Open My Races to link it to a catalog race.`
          : "Imported. Open My Races to link it to a catalog race."
      );
    });
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".fit,.gpx,.tcx,application/octet-stream,text/xml,application/xml"
        className="sr-only"
        aria-hidden
        onChange={onFile}
      />
      <div className="rounded-xl border border-white/10 bg-[#0a0c12] p-6 md:p-8">
        <p className="type-eyebrow text-accent">Without Strava</p>
        <h2 className="mt-2 font-display text-2xl font-normal tracking-tight text-white md:text-3xl">
          Import activity file
        </h2>
        <p className="type-meta mt-3 max-w-xl text-sm leading-relaxed text-white/70">
          Upload a <strong className="font-medium text-white/85">.fit</strong> (Garmin / watch export),{" "}
          <strong className="font-medium text-white/85">.gpx</strong>, or{" "}
          <strong className="font-medium text-white/85">.tcx</strong> file. We parse distance, time, elevation, and
          route when present, save it like a synced activity, and you can use{" "}
          <Link href="/my-races" className="font-semibold text-accent underline-offset-4 hover:underline">
            My Races
          </Link>{" "}
          to link the effort to a verified race — same flow as Strava imports.
        </p>
        <ul className="type-meta mt-4 list-inside list-disc space-y-1 text-sm text-white/55">
          <li>Re-uploading the same file is rejected (duplicate detection).</li>
          <li>Partial parses are allowed; we surface import notes on the activity when something was missing.</li>
          <li>Max file size 25 MB.</li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="min-h-[48px] rounded-[14px] bg-accent px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#f08a4d]"
            disabled={pending}
            aria-busy={pending}
            onClick={pickFile}
          >
            {pending ? "Importing…" : "Choose file (.fit, .gpx, .tcx)"}
          </Button>
          <Link
            href="/my-races"
            className="text-[12px] font-semibold uppercase tracking-[0.15em] text-muted hover:text-white"
          >
            My Races →
          </Link>
        </div>
        {err ? (
          <p className="mt-4 text-sm text-red-300/95" role="alert">
            {err}
          </p>
        ) : null}
        {msg ? (
          <p className="mt-4 text-sm text-emerald-200/90" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
