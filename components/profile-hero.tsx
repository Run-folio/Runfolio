import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  displayName: string;
  /** Full-bleed photo — use a real image file, not a screenshot of a webpage */
  imageSrc: string;
  tagline?: string | null;
  location?: string | null;
  /** Stats or other supplemental content; placed in the lower hero band */
  footer?: ReactNode;
};

export function ProfileHero({ displayName, imageSrc, tagline, location, footer }: Props) {
  const line =
    tagline?.trim() ||
    "Every race tells a story — this is the curated version, not the full training log.";

  return (
    <section className="relative min-h-[min(78vh,640px)] w-full overflow-hidden border-b border-border">
      <Image
        src={imageSrc}
        alt="Profile cover"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/55 to-transparent sm:bg-gradient-to-r sm:from-[#05070c]/92 sm:via-[#05070c]/40 sm:to-transparent sm:to-55%"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[min(78vh,640px)] w-full max-w-[1400px] flex-col justify-end px-6 py-10 md:px-8 md:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className={`font-display text-4xl font-normal text-white md:text-5xl lg:text-[3.25rem]`}>
              {displayName}
            </h1>
            <p className="mt-5 text-lg font-normal leading-snug text-white/92 md:text-xl">&ldquo;{line}&rdquo;</p>
            {location?.trim() ? (
              <p className="mt-5 flex items-center gap-2 text-sm text-white/88">
                <span className="text-gold" aria-hidden>
                  ◎
                </span>
                {location.trim()}
              </p>
            ) : null}
          </div>
          <p className={`hidden max-w-xs font-display text-lg italic leading-snug text-white/75 md:block md:text-xl`}>
            Portfolio, not pace charts.
          </p>
        </div>
        {footer ? <div className="relative z-10 mt-10 md:mt-12">{footer}</div> : null}
      </div>
    </section>
  );
}
