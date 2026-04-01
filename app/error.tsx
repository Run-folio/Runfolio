"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Runfolio:client] app/error boundary:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-6 px-6 py-16 text-white">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="text-sm leading-relaxed text-red-300">{error.message}</p>
      {error.digest ? <p className="text-xs text-muted">Reference: {error.digest}</p> : null}
      <p className="text-xs text-muted">
        Check the terminal (local) or Vercel deployment logs for lines starting with{" "}
        <code className="text-white/80">[Runfolio:</code>.
      </p>
      <button
        type="button"
        className="w-fit rounded-[12px] border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/5"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
