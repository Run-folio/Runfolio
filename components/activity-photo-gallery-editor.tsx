"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  stravaActivityId: string;
  manualUrls: string[];
  stravaPhotoUrls: string[];
  onCommitManualUrls: (urls: string[]) => void;
  busy?: boolean;
};

export function ActivityPhotoGalleryEditor({
  stravaActivityId,
  manualUrls,
  stravaPhotoUrls,
  onCommitManualUrls,
  busy
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragManualIndex, setDragManualIndex] = useState<number | null>(null);

  const stravaOnly = useMemo(
    () => stravaPhotoUrls.filter((u) => !manualUrls.includes(u)),
    [manualUrls, stravaPhotoUrls]
  );
  const merged = useMemo(() => [...manualUrls, ...stravaOnly], [manualUrls, stravaOnly]);

  const uploadFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files?.length || busy) return;
      setUploadErr(null);
      const list = Array.from(files as FileList);
      const next = [...manualUrls];
      for (const file of list) {
        if (!file.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.set("file", file);
        fd.set("strava_activity_id", stravaActivityId);
        try {
          const res = await fetch("/api/race-portfolio-photos", { method: "POST", body: fd });
          const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
          if (!res.ok || !data.ok || !data.url) {
            setUploadErr(data.error || "Upload failed.");
            continue;
          }
          next.push(data.url);
        } catch {
          setUploadErr("Upload failed.");
        }
      }
      if (next.length !== manualUrls.length) onCommitManualUrls(next);
    },
    [busy, manualUrls, onCommitManualUrls, stravaActivityId]
  );

  const setCover = (url: string) => {
    if (busy) return;
    const rest = manualUrls.filter((u) => u !== url);
    if (manualUrls.includes(url)) {
      onCommitManualUrls([url, ...rest]);
      return;
    }
    onCommitManualUrls([url, ...manualUrls]);
  };

  const removeUrl = (url: string) => {
    if (busy) return;
    if (!manualUrls.includes(url)) return;
    onCommitManualUrls(manualUrls.filter((u) => u !== url));
  };

  const moveManual = (from: number, to: number) => {
    if (busy || from === to || from < 0 || to < 0 || from >= manualUrls.length || to >= manualUrls.length) return;
    const next = [...manualUrls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onCommitManualUrls(next);
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border border-dashed px-4 py-8 text-center transition",
          dragOver ? "border-teal/50 bg-teal/5" : "border-white/15 bg-white/[0.02] hover:border-white/25"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-white/85">Drop images here or click to add</p>
        <p className="mt-1 text-xs text-muted">JPEG, PNG, WebP, or GIF · up to 5 MB each</p>
      </div>
      {uploadErr ? <p className="text-sm text-red-300">{uploadErr}</p> : null}

      {merged.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {merged.map((url, i) => {
            const isManual = manualUrls.includes(url);
            const manualIndex = isManual ? manualUrls.indexOf(url) : -1;
            const fromStravaFeed = stravaOnly.includes(url);
            const isCover = i === 0;
            return (
              <li
                key={`${url}-${i}`}
                draggable={isManual && !busy}
                onDragStart={() => isManual && setDragManualIndex(manualIndex)}
                onDragEnd={() => setDragManualIndex(null)}
                onDragOver={(e) => isManual && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragManualIndex == null || !isManual) return;
                  moveManual(dragManualIndex, manualIndex);
                  setDragManualIndex(null);
                }}
                className={cn(
                  "relative overflow-hidden border bg-black/50",
                  isCover ? "border-gold/50 ring-1 ring-gold/30" : "border-white/12"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCover(url);
                    }}
                    className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-white/25 disabled:opacity-50"
                  >
                    Cover
                  </button>
                  {isManual ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || manualIndex <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveManual(manualIndex, manualIndex - 1);
                        }}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-30"
                        aria-label="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={busy || manualIndex >= manualUrls.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveManual(manualIndex, manualIndex + 1);
                        }}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-30"
                        aria-label="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUrl(url);
                        }}
                        className="ml-auto rounded bg-red-500/25 px-2 py-0.5 text-[10px] font-medium text-red-200 hover:bg-red-500/40"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                      {fromStravaFeed ? "Strava" : "Photo"}
                    </span>
                  )}
                </div>
                {isCover ? (
                  <span className="absolute left-2 top-2 rounded bg-gold/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                    Cover
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">No photos yet — add some above or sync from Strava when available.</p>
      )}
    </div>
  );
}
