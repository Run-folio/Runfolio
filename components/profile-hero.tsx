import Image from "next/image";

type Props = {
  displayName: string;
  /** Full-bleed photo — use a real image file, not a screenshot of a webpage */
  imageSrc: string;
};

export function ProfileHero({ displayName, imageSrc }: Props) {
  return (
    <section className="relative min-h-[min(85vh,720px)] w-full overflow-hidden border-b border-border">
      <Image
        src={imageSrc}
        alt="Profile cover"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      {/* Light bottom readbility only — keeps focus on the photograph */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/50 to-transparent sm:bg-gradient-to-r sm:from-[#05070c]/90 sm:via-[#05070c]/35 sm:to-transparent sm:to-60%"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[min(85vh,720px)] w-full max-w-[1400px] flex-col justify-between px-6 py-10 md:flex-row md:px-8 md:py-14">
        <div className="max-w-xl self-end md:self-center">
          <h1 className={`font-display text-4xl font-normal text-white md:text-5xl lg:text-6xl`}>{displayName}</h1>
          <p className="mt-4 text-lg font-normal text-white/95 md:text-xl">&ldquo;Chasing big days in the mountains.&rdquo;</p>
          <p className="mt-5 flex items-center gap-2 text-sm text-white/90">
            <span className="text-gold" aria-hidden>
              ◎
            </span>
            Colorado, USA
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
            <span className="text-gold" aria-hidden>
              ▲
            </span>
            Ultrarunner | Marathoner
          </p>
        </div>

        <div className="relative mt-10 max-w-xs self-end md:mt-0 md:self-start">
          <p className={`font-display text-xl italic leading-snug text-white md:text-2xl`}>
            Every race tells a story.
            <br />
            This is mine.
          </p>
          <span className="mt-4 hidden text-5xl font-thin leading-none text-white/40 md:block">↯</span>
        </div>
      </div>
    </section>
  );
}
