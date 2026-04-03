import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "attention" | "success";

type Props = {
  variant?: Variant;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  primary?: { href: string; label: string; external?: boolean };
  secondary?: { href: string; label: string; external?: boolean };
  className?: string;
};

const tones: Record<Variant, string> = {
  neutral: "border-white/12 bg-[#0c1018]/90",
  attention: "border-amber-500/35 bg-amber-500/[0.07]",
  success: "border-emerald-500/35 bg-emerald-500/[0.06]"
};

export function SetupCallout({
  variant = "neutral",
  eyebrow,
  title,
  children,
  primary,
  secondary,
  className
}: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] md:p-8",
        tones[variant],
        className
      )}
    >
      {eyebrow ? (
        <p className="type-eyebrow text-accent/90">{eyebrow}</p>
      ) : null}
      <h2 className="font-display mt-2 text-2xl font-normal tracking-tight text-white md:text-3xl">{title}</h2>
      <div className="type-meta mt-4 space-y-3 text-base leading-relaxed text-white/72">{children}</div>
      {(primary ?? secondary) ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {primary ? (
            primary.external ? (
              <a
                href={primary.href}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-accent px-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f08a4d]"
              >
                {primary.label}
              </a>
            ) : (
              <Link
                href={primary.href}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-accent px-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f08a4d]"
              >
                {primary.label}
              </Link>
            )
          ) : null}
          {secondary ? (
            secondary.external ? (
              <a
                href={secondary.href}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-white/18 px-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/75 transition hover:border-white/30 hover:text-white"
              >
                {secondary.label}
              </a>
            ) : (
              <Link
                href={secondary.href}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-white/18 px-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/75 transition hover:border-white/30 hover:text-white"
              >
                {secondary.label}
              </Link>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
