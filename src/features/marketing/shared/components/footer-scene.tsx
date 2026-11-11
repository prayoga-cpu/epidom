"use client";

import Image from "next/image";
import { Banknote, ChefHat, Smartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { EpidomWordmark } from "./epidom-logo";

/** The three spaces, recapped: the same names and one-liners as the home page's step cards. */
const SPACES: readonly { key: "storefront" | "pos" | "backOffice"; icon: LucideIcon }[] = [
  { key: "storefront", icon: Smartphone },
  { key: "pos", icon: ChefHat },
  { key: "backOffice", icon: Banknote },
];

/** The three star tiles (white dots at set offsets), seamless when the tile is repeated. */
const dots = (list: readonly [number, number, number, number][]) =>
  list
    .map(
      ([r, x, y, a]) =>
        `radial-gradient(${r}px ${r}px at ${x}px ${y}px, rgba(255,255,255,${a}), transparent)`
    )
    .join(", ");
const STARS_NEAR = dots([
  [1.5, 20, 30, 0.8],
  [1, 90, 84, 0.6],
  [1, 156, 22, 0.7],
  [1.5, 62, 152, 0.55],
  [1, 174, 128, 0.65],
]);
const STARS_FAR = dots([
  [1, 14, 20, 0.5],
  [1, 70, 96, 0.45],
  [1, 112, 44, 0.5],
  [1, 40, 118, 0.4],
]);
const STARS_BRIGHT = dots([
  [2, 60, 70, 0.95],
  [2, 190, 150, 0.9],
  [2, 240, 40, 0.85],
  [2, 120, 230, 0.9],
]);

/** One turn of the phone orbit, in seconds (the CSS keyframes in globals.css run 26s too). */
const ORBIT_SECONDS = 26;

/**
 * The footer's illustration: closing time. A real photo of an empty café, in the
 * morning and in the evening, cross-fading on a slow loop (grayscale CC0 files, see
 * public/images/spaces/CREDITS.md), is laid
 * as a faint texture on the navy night, warmed by one gold glow, with the three
 * spaces Epidom runs (Phone Orders, POS Mode, Store Dashboard) as small glass
 * chips on top: a row from the sm breakpoint up and, on a phone, three small
 * chips orbiting a tilted ring like Saturn's (CSS 3D, see ".epi-orbit" in
 * globals.css; each chip stays facing the screen; reduced motion keeps the
 * static stack). Under it, the wordmark set large on the night sky with the
 * tagline under it. The picture, chips and wordmark are decoration (the chips
 * repeat what the page already says), hidden from assistive tech; the tagline
 * is real text. It replaced the sunset scene (2026-11-11): the palette is the
 * site's own, navy and gold, again.
 */
export function FooterScene({ tagline }: { tagline: string }) {
  const { t } = useI18n();
  return (
    <div className="relative mt-12 overflow-hidden select-none">
      <div
        aria-hidden="true"
        // z-10: the orbiting chips may swell past this box (perspective), and must paint over the wordmark section below, not under it.
        className="relative z-10 flex min-h-[clamp(300px,30vw,460px)] items-center justify-center bg-[#0b1330] px-4 py-14 md:py-16"
      >
        {/* Morning and evening, cross-fading on a slow loop (see ".epi-daynight-*" in
            globals.css); with reduced motion only the evening photo shows. */}
        <Image
          src="/images/spaces/morning-time.jpg"
          alt=""
          fill
          sizes="100vw"
          className="epi-daynight-day object-cover mix-blend-screen"
        />
        <Image
          src="/images/spaces/closing-time.jpg"
          alt=""
          fill
          sizes="100vw"
          className="epi-daynight-night object-cover mix-blend-screen"
        />
        {/* One warm gold glow where the lamps hang, then fades into the sections above and below */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 55% 70% at 50% 62%, rgba(217,174,59,0.34), transparent 70%), linear-gradient(180deg, var(--epi-navy-950, #070b14) 0%, rgba(11,19,48,0) 38%, rgba(11,19,48,0) 62%, #121c42 100%)",
          }}
        />
        {/* A phone: the chips orbit on a tilted ring (rules in globals.css, ".epi-orbit").
            From sm up, and with reduced motion, it is a plain row/stack of chips. */}
        <div className="epi-orbit relative w-full max-w-5xl">
          <ul className="epi-orbit-spin relative m-0 flex w-full list-none flex-col gap-3 p-0 sm:flex-row sm:gap-4">
            {SPACES.map(({ key, icon: Icon }, i) => (
              <li
                key={key}
                className="epi-orbit-item flex flex-1"
                style={
                  {
                    "--a": `${(i * 360) / SPACES.length}deg`,
                    // Each chip peaks as it passes the front: start its fade part-way round.
                    "--d": `${-(i / SPACES.length) * ORBIT_SECONDS}s`,
                  } as React.CSSProperties
                }
              >
                <div className="epi-orbit-face flex w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.1] px-4 py-3.5 shadow-[0_12px_40px_rgba(10,16,32,0.45)] backdrop-blur-md">
                  <span className="epi-orbit-icon bg-epi-gold-500 flex size-10 shrink-0 items-center justify-center rounded-full text-[#1a2547]">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 leading-snug">
                    <span className="epi-orbit-name text-epi-cream-50 block text-[15px] font-semibold">
                      {t(`redesign.landing.spaces.${key}Name`)}
                    </span>
                    <span className="epi-orbit-short text-epi-cream-50/75 block text-[13px]">
                      {t(`redesign.landing.spaces.${key}Short`)}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The wordmark, large, on a night sky, and the tagline under it */}
      <div
        className="relative flex flex-col items-center overflow-hidden px-4 pt-10 pb-6"
        style={{
          background:
            "linear-gradient(180deg, #121c42 0%, #0b1330 55%, var(--epi-navy-950, #070b14) 100%)",
        }}
      >
        {/* The sky: three star layers drifting at different speeds, one twinkling, and a
            shooting star every so often (rules in globals.css). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="epi-stars-drift absolute inset-0"
            style={{
              backgroundImage: STARS_NEAR,
              backgroundSize: "200px 200px",
              ["--tx" as string]: "200px",
              ["--ty" as string]: "120px",
              ["--dur" as string]: "90s",
            }}
          />
          <div
            className="epi-stars-drift absolute inset-0 opacity-70"
            style={{
              backgroundImage: STARS_FAR,
              backgroundSize: "130px 130px",
              ["--tx" as string]: "-130px",
              ["--ty" as string]: "40px",
              ["--dur" as string]: "150s",
            }}
          />
          <div
            className="epi-stars-twinkle absolute inset-0"
            style={{
              backgroundImage: STARS_BRIGHT,
              backgroundSize: "280px 280px",
              ["--tx" as string]: "280px",
              ["--ty" as string]: "80px",
              ["--dur" as string]: "200s",
            }}
          />
          <span
            className="epi-shooting"
            style={{
              top: "8%",
              left: "12%",
              ["--dur" as string]: "13s",
              ["--delay" as string]: "3s",
            }}
          />
          <span
            className="epi-shooting"
            style={{
              top: "22%",
              left: "56%",
              ["--dx" as string]: "300px",
              ["--dy" as string]: "134px",
              ["--dur" as string]: "21s",
              ["--delay" as string]: "10s",
            }}
          />
        </div>
        <div
          aria-hidden="true"
          className="relative"
          style={{
            color: "rgba(214,222,255,0.2)",
            maskImage: "linear-gradient(180deg, #000 30%, rgba(0,0,0,0.25) 100%)",
            WebkitMaskImage: "linear-gradient(180deg, #000 30%, rgba(0,0,0,0.25) 100%)",
          }}
        >
          <EpidomWordmark
            style={{ display: "block", width: "clamp(260px, 78vw, 1000px)", height: "auto" }}
          />
        </div>
        <p className="epi-display-light text-epi-cream-50/75 relative m-0 mt-4 text-center text-[clamp(20px,2.6vw,32px)] leading-tight text-balance">
          {tagline}
        </p>
      </div>
    </div>
  );
}
