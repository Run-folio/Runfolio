"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Runfolio:client] global-error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#05070c] px-6 py-16 font-sans text-white antialiased">
        <h1 className="text-2xl font-semibold">Runfolio — critical error</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-red-300">{error.message}</p>
        {error.digest ? <p className="mt-2 text-xs text-white/50">Reference: {error.digest}</p> : null}
        <p className="mt-6 max-w-xl text-xs text-white/60">
          Search server logs for <code className="text-white/80">[Runfolio:</code> (e.g.{" "}
          <code className="text-white/80">middleware.</code>, <code className="text-white/80">supabase.</code>).
        </p>
        <button
          type="button"
          className="mt-8 rounded-[12px] border border-white/30 px-4 py-2 text-sm font-semibold"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
