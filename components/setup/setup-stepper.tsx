"use client";

import { cn } from "@/lib/utils";
import type { OnboardingStepVisual } from "@/lib/onboarding-progress";

type Props = { steps: OnboardingStepVisual[] };

export function SetupStepper({ steps }: Props) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 md:gap-3" aria-label="Setup progress">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 md:gap-3">
          {i > 0 ? (
            <span
              className={cn(
                "hidden h-px w-4 md:block",
                s.done || (i > 0 && steps[i - 1]?.done) ? "bg-emerald-500/50" : "bg-white/10"
              )}
              aria-hidden
            />
          ) : null}
          <div
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] md:text-[11px]",
              s.active
                ? "border-accent/60 bg-accent/15 text-accent"
                : s.skipped
                  ? "border-white/15 bg-white/[0.02] text-white/40"
                  : s.done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100/90"
                    : "border-white/10 bg-white/[0.03] text-white/35"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                s.active
                  ? "bg-accent text-white"
                  : s.skipped
                    ? "border border-dashed border-white/25 bg-transparent text-white/40"
                    : s.done
                      ? "bg-emerald-500/90 text-white"
                      : "bg-white/10 text-white/50"
              )}
              aria-hidden
            >
              {s.skipped ? "–" : s.done ? "✓" : i + 1}
            </span>
            <span className="truncate">{s.label}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
