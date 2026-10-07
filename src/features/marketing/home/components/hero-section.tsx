"use client";

import Image from "next/image";
import Link from "next/link";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/version";
import { HERO_PHOTO } from "../data/media";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON, TEXT_LINK } from "./landing-ui";

/**
 * The hero. Its layout follows the NestJS homepage: a full-bleed rounded card
 * over the café photo with the floating site header sitting inside it (see the
 * `[data-hero-card]` rule in globals.css), a large centred headline and lede,
 * the POS trial (filled) and the margin calculator (text) side by side, and at
 * the bottom the way in for people who already have a till (left) and three
 * plain facts (right). The type is Epidom's own: the display face in capitals
 * with the key words in gold (marked `*like this*` in the locale string), Jost
 * for the lede and facts, the brand's gold pill button.
 *
 * Nothing animates on entry: the photo and the headline are the LCP candidates
 * and have to paint straight away. The facts are product facts, not usage
 * numbers; the release line is the running build's own version and date.
 *
 * Vertical spacing and the headline size follow the viewport height as well as
 * its width, and tighten further on short screens (the `short:` variant, max
 * 800px tall: a laptop browser window, a phone held sideways), so the whole
 * card, facts included, fits the first screen as in the reference.
 */
export function HeroSection({ onOpenMigration }: { onOpenMigration: () => void }) {
  const { t, locale } = useI18n();
  const trialHref = usePosTrialHref();
  // "Orders to *Margin* Controller": the part between asterisks is set in gold.
  const [titleBefore, titleAccent = "", titleAfter = ""] = t("redesign.landing.hero.title").split(
    "*"
  );

  // The release day is a calendar date: read and print it in UTC so it never
  // slips to the day before for a visitor west of Greenwich.
  const releaseDay = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${APP_RELEASE_DATE}T00:00:00Z`));

  const facts = [
    {
      key: "storefront",
      label: t("redesign.landing.hero.storefrontLabel"),
      value: t("redesign.landing.hero.storefrontValue"),
    },
    {
      key: "support",
      label: t("redesign.landing.hero.supportLabel"),
      value: t("redesign.landing.hero.supportValue"),
    },
    {
      key: "release",
      label: t("redesign.landing.hero.releaseLabel"),
      value: `${releaseDay} / ${APP_VERSION}`,
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
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* The measure is in em so the headline keeps two lines at any size:
                8.2em holds the longest line ("COMMANDE À LA MARGE.") and breaks
                "ORDERS TO MARGIN CONTROLLER" the way the reference breaks its own. */}
            <h1
              id="hero-title"
              className="epi-display text-epi-cream-50 sm:short:text-[length:clamp(44px,min(9.5vw,12svh),144px)] m-0 max-w-[8.2em] text-[length:clamp(52px,min(9.5vw,14svh),144px)] text-balance"
            >
              {titleBefore}
              {titleAccent ? <span className="text-epi-gold-400">{titleAccent}</span> : null}
              {titleAfter}
            </h1>
            <p className="text-epi-cream-50/75 sm:short:mt-[clamp(0.75rem,2.5svh,1.5rem)] sm:short:text-base mt-6 max-w-2xl text-base leading-relaxed text-balance sm:mt-[clamp(1rem,3svh,2rem)] sm:text-lg">
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
