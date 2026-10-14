"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trackEvent } from "@/lib/analytics";
import { WHATSAPP_NUMBERS, whatsappHref } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/version";
import { HERO_PHOTO } from "../data/media";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON, TEXT_LINK } from "./landing-ui";

/**
 * The letter of the headline that is drawn as a lightning bolt: the "i" of
 * "realtime" ("REALT⚡ME POS", "KASIR REALT⚡ME") and the "s" of "temps réel"
 * ("CAISSE EN TEMP⚡ RÉEL"). The group is the text before that letter. No
 * lookbehind: older iOS Safari throws on it when the module loads.
 */
const BOLT_LETTER = /(realt)i(?=me)|(temp)s(?=\s+r[ée]el)/i;

/**
 * The lightning bolt. Drawn to the display face's cap height (0.7em) and sat
 * on the baseline, so it reads as a letter at any headline size.
 */
function Bolt() {
  return (
    <svg
      viewBox="0 0 38 70"
      aria-hidden="true"
      focusable="false"
      className="text-epi-gold-400 mx-[0.03em] inline-block h-[0.7em] w-[0.38em] fill-current align-baseline"
    >
      <path d="M14 0H34L24 26H34L10 70L16 36H4Z" />
    </svg>
  );
}

/**
 * The width of a one-line text in em, for sizing it to a container in CSS
 * (`calc(100cqi / em)`). Estimated from the length for the server render and
 * the first paint, then measured once the line is laid out and again once the
 * web fonts have loaded. offsetWidth and the computed font size are both CSS px
 * before any page zoom (the app's zoom setting), so the ratio holds under it.
 */
function useEmWidth(text: string, emPerChar: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [em, setEm] = useState(() => text.length * emPerChar);
  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      if (!live || !el) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && el.offsetWidth > 0) setEm(Math.round((el.offsetWidth / size) * 1000) / 1000);
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [text]);
  return [ref, em] as const;
}

/** Average widths of one capital, in em (tracking included): the h1's Bebas, the tagline's Oswald Light. */
const TITLE_EM_PER_CHAR = 0.37;
const TAGLINE_EM_PER_CHAR = 0.48;

/**
 * A fact's value that opens something: plain text until hovered, then gold. The
 * pseudo-element is its tap area, 44px tall on a phone (the rows are 25px
 * apart there, so neighbours never overlap) and 38px on desktop, where the
 * rows sit 16px apart, without moving the text.
 */
const FACT_LINK =
  "relative text-epi-cream-50 hover:text-epi-gold-300 focus-visible:outline-epi-gold-300 rounded-sm underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-epi-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-[''] lg:before:-inset-y-2";

/**
 * The hero. Its layout follows the NestJS homepage: a full-bleed rounded card
 * over the café photo with the floating site header sitting inside it (see the
 * `[data-hero-card]` rule in globals.css), a large centred headline and lede,
 * the POS trial (filled) and the margin calculator (text) side by side, and at
 * the bottom the way in for people who already have a till (left) and two
 * facts (right), each a way in: support opens the WhatsApp numbers, the last
 * update opens the changelog. The type is Epidom's own: the display face in capitals
 * with a gold lightning bolt for one letter, its light companion for the
 * tagline, Jost for the lede and facts, the brand's gold pill button.
 *
 * Nothing animates on entry: the photo and the headline are the LCP candidates
 * and have to paint straight away. The facts are product facts, not usage
 * numbers; the update line is the running build's own version and date.
 *
 * Vertical spacing and the headline size follow the viewport height as well as
 * its width, and tighten further on short screens (the `short:` variant, max
 * 800px tall: a laptop browser window, a phone held sideways), so the whole
 * card, facts included, fits the first screen as in the reference.
 */
export function HeroSection({ onOpenMigration }: { onOpenMigration: () => void }) {
  const { t, locale } = useI18n();
  const trialHref = usePosTrialHref();
  // One letter of the "realtime" word is drawn as a gold lightning bolt (see
  // BOLT_LETTER). The drawn copy keeps the replaced letter in its text, undrawn,
  // so the h1's text is the title exactly once ("REALTIME", not "REALTME", and
  // not the title twice, as when a second sr-only copy sat beside it). Screen
  // readers get the plain title from the h1's aria-label, so they never read
  // the word in pieces around the drawing.
  const title = t("redesign.landing.hero.title");
  const boltMatch = BOLT_LETTER.exec(title);
  const boltAt = boltMatch ? boltMatch.index + (boltMatch[1] ?? boltMatch[2] ?? "").length : -1;
  const [titleRef, titleEm] = useEmWidth(title, TITLE_EM_PER_CHAR);
  const tagline = t("redesign.landing.hero.tagline");
  const [taglineRef, taglineEm] = useEmWidth(tagline, TAGLINE_EM_PER_CHAR);

  // The release day is a calendar date: read and print it in UTC so it never
  // slips to the day before for a visitor west of Greenwich.
  const releaseDay = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${APP_RELEASE_DATE}T00:00:00Z`));

  // Both markets' numbers, the visitor's own first.
  const supportLines = (locale === "id" ? (["id", "fr"] as const) : (["fr", "id"] as const)).map(
    (market) => ({
      market,
      number: WHATSAPP_NUMBERS[market].number,
      label: t(`redesign.landing.hero.${market === "fr" ? "supportFrance" : "supportIndonesia"}`),
    })
  );

  const facts = [
    {
      key: "support",
      label: t("redesign.landing.hero.supportLabel"),
      value: (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn(FACT_LINK, "cursor-pointer")}>
              {t("redesign.landing.hero.supportValue")}
            </button>
          </PopoverTrigger>
          {/* Above the site's floating header (z-index 60), like the migration
              modal, and flipped below the trigger rather than opening under it
              when the hero is scrolled near the top (the header ends ~102px down). */}
          <PopoverContent
            side="top"
            align="end"
            sideOffset={10}
            collisionPadding={{ top: 112 }}
            className="bg-epi-navy-900 text-epi-cream-50 z-[70] w-64 rounded-2xl border-white/10 p-2"
          >
            <p className="text-epi-cream-50/55 m-0 px-3 pt-2 pb-1 text-[11px] tracking-[0.16em] uppercase">
              {t("redesign.landing.hero.supportPopoverTitle")}
            </p>
            <ul className="m-0 list-none p-0">
              {supportLines.map((line) => (
                <li key={line.market}>
                  <a
                    href={whatsappHref(line.number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("hero_support_click", { market: line.market })}
                    className="text-epi-cream-50 hover:text-epi-gold-300 focus-visible:outline-epi-gold-300 flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[15px] hover:bg-white/[0.06] focus-visible:outline-2"
                  >
                    {line.label}
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ),
    },
    {
      key: "release",
      label: t("redesign.landing.hero.releaseLabel"),
      value: (
        <Link href={getLocalizedPath("/changelog", locale)} className={FACT_LINK}>
          {`${releaseDay} / ${APP_VERSION}`}
        </Link>
      ),
    },
  ];

  return (
    <section aria-labelledby="hero-title" className="p-2 sm:p-3 lg:p-4">
      <div
        data-hero-card
        className="bg-epi-navy-850 relative isolate flex min-h-[calc(100svh/var(--app-zoom,1)_-_1rem)] flex-col overflow-hidden rounded-[24px] ring-1 ring-white/10 sm:min-h-[calc(100svh/var(--app-zoom,1)_-_1.5rem)] sm:rounded-[32px] lg:min-h-[calc(100svh/var(--app-zoom,1)_-_2rem)]"
      >
        {HERO_PHOTO ? (
          <Image
            src={HERO_PHOTO.src}
            alt={HERO_PHOTO.alt[locale]}
            fill
            preload
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            // The build always provides blurDataURL for a static import; tests don't.
            placeholder={HERO_PHOTO.src.blurDataURL ? "blur" : "empty"}
            className="-z-20 object-cover object-[50%_40%]"
          />
        ) : null}
        {/* Navy wash, a darker pool behind the headline (the photo's white wall
            sits right there), a gold glow in the corner, and a dark foot for the
            facts: cream text stays at WCAG AA over any part of the photo. */}
        <div aria-hidden="true" className="bg-epi-navy-950/50 absolute inset-0 -z-10" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_62%_58%_at_50%_44%,rgba(4,8,15,0.82),rgba(4,8,15,0.3)_70%,transparent)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_90%_-10%,rgba(217,174,59,0.28),transparent_42%)]"
        />
        <div
          aria-hidden="true"
          className="from-epi-navy-950/95 absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t to-transparent"
        />

        <div className="sm:short:pb-5 lg:short:pb-4 flex flex-1 flex-col px-5 pt-28 pb-6 sm:px-10 sm:pt-[clamp(6rem,14svh,9rem)] sm:pb-8 lg:px-14 lg:pt-[clamp(6.5rem,15svh,10rem)] lg:pb-[clamp(1.5rem,4svh,3rem)]">
          <div className="[container-type:inline-size] flex flex-1 flex-col items-center justify-center text-center">
            {/* The h1 is only the product ("REALTIME POS"); under it, the promise
                in the display face's light companion, one colour, on one line
                exactly as wide as the h1.
                - The h1 keeps one line: where its usual size would not fit the
                  column (French on a phone), it shrinks to the column's width
                  (100cqi over its width in em, --title-em).
                - The wrapper takes the h1's width; the tagline's box fills it
                  without adding to it (w-0 min-w-full) and is a size container,
                  so the tagline is sized to exactly that width (--tagline-em).
                Without container units (older Safari) both keep their plain
                sizes and may wrap, as before. */}
            <div className="flex max-w-full flex-col">
              <h1
                id="hero-title"
                aria-label={boltAt >= 0 ? title : undefined}
                style={{ "--title-em": titleEm } as React.CSSProperties}
                className="epi-display text-epi-cream-50 sm:short:[--title-size:clamp(44px,min(9.5vw,12svh),144px)] m-0 max-w-[8.2em] text-[length:var(--title-size)] text-balance [--title-size:clamp(52px,min(9.5vw,14svh),144px)] supports-[width:1cqi]:max-w-none supports-[width:1cqi]:text-[length:min(var(--title-size),calc(100cqi/var(--title-em)))] supports-[width:1cqi]:whitespace-nowrap"
              >
                <span ref={titleRef}>
                  {boltAt >= 0 ? (
                    <>
                      {title.slice(0, boltAt)}
                      <Bolt />
                      <span className="sr-only">{title[boltAt]}</span>
                      {title.slice(boltAt + 1)}
                    </>
                  ) : (
                    title
                  )}
                </span>
              </h1>
              <div className="[container-type:inline-size] w-0 min-w-full">
                <p
                  style={{ "--tagline-em": taglineEm } as React.CSSProperties}
                  className="epi-display-light text-epi-cream-50/85 mt-3 text-[length:clamp(16px,2.4vw,40px)] supports-[width:1cqi]:text-[length:calc(100cqi/var(--tagline-em))] supports-[width:1cqi]:whitespace-nowrap sm:mt-[clamp(0.5rem,1.5svh,1rem)]"
                >
                  <span ref={taglineRef}>{tagline}</span>
                </p>
              </div>
            </div>
            {/* The lede is set at the size of the trial note under the buttons
                (text-sm), so the h1 and its tagline carry the hero. */}
            <p className="text-epi-cream-50/75 sm:short:mt-[clamp(0.75rem,2.5svh,1.5rem)] mt-6 max-w-xl text-sm leading-snug text-balance sm:mt-[clamp(1rem,3svh,2rem)]">
              {t("redesign.landing.hero.sub")}
            </p>

            <div className="sm:short:mt-5 mt-8 flex w-full flex-col items-stretch gap-3 sm:mt-[clamp(1.5rem,5svh,3rem)] sm:w-auto sm:flex-row sm:items-center sm:gap-6">
              <Link
                href={trialHref}
                onClick={() => trackEvent("hero_cta_click", { cta: "trial" })}
                className={cn(PRIMARY_BUTTON, "min-h-14 px-8")}
              >
                {t("redesign.landing.hero.ctaTrial")}
              </Link>
              <a
                href="#calculator"
                onClick={() => trackEvent("hero_cta_click", { cta: "calculator" })}
                className="text-epi-cream-50 hover:text-epi-gold-300 focus-visible:outline-epi-gold-300 inline-flex min-h-14 items-center justify-center rounded-full px-6 text-sm font-medium tracking-[0.06em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {t("redesign.landing.hero.ctaCalculator")}
              </a>
            </div>
            <p className="text-epi-cream-50/60 mt-4 max-w-md text-sm leading-snug text-balance lg:max-w-xl">
              {t("redesign.landing.hero.ctaTrialNote")}
            </p>
          </div>

          {/* On desktop the bottom row takes the floating nav pill's width, so the
              link starts under the logo and the facts end under the header's
              button, as in the reference (see .epi-floating-nav in globals.css). */}
          <div className="lg:short:mt-4 mt-12 flex flex-col gap-8 lg:mx-auto lg:mt-[clamp(1.5rem,4svh,2.5rem)] lg:w-full lg:max-w-[min(max(72vw,920px),1080px)] lg:flex-row lg:items-end lg:justify-between">
            <button
              type="button"
              onClick={onOpenMigration}
              // lg:items-end: a one-line link sits on the 44px box's bottom edge, on the
              // same baseline as the last fact, instead of floating 10px above it.
              className={cn(TEXT_LINK, "max-w-sm cursor-pointer text-left leading-6 lg:items-end")}
            >
              {t("redesign.landing.hero.migrationLink")}
            </button>

            <dl className="lg:short:gap-2 m-0 flex flex-col gap-3 lg:gap-4">
              {facts.map((fact) => (
                <div
                  key={fact.key}
                  className="flex items-baseline justify-between gap-6 border-t border-white/10 pt-3 lg:justify-end lg:border-0 lg:pt-0"
                >
                  <dt className="text-epi-cream-50/55 text-[11px] tracking-[0.16em] uppercase">
                    {fact.label}
                  </dt>
                  <dd className="text-epi-cream-50 m-0 text-right text-[15px]">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
