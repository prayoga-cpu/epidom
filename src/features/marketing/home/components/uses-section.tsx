"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Beer,
  Check,
  ChefHat,
  Coffee,
  Croissant,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { INDUSTRY_GUIDES } from "../lib/industry-guides";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { aurora, PRIMARY_BUTTON, SectionHeading } from "./landing-ui";

type Kind = "cafe" | "restaurant" | "bakery" | "bar" | "truck";

const KINDS: readonly { kind: Kind; icon: LucideIcon }[] = [
  { kind: "cafe", icon: Coffee },
  { kind: "restaurant", icon: ChefHat },
  { kind: "bakery", icon: Croissant },
  { kind: "bar", icon: Beer },
  { kind: "truck", icon: Truck },
];

/**
 * "What is Epidom used for?": a tab per kind of food and drink business and,
 * under it, ONE card: a photo carousel of that kind of place beside one
 * headline, three short ticks and two actions: start the free trial, or read
 * that business's guide on the blog. F&B only.
 *
 * The photos are files in public/images/uses/{kind}-{n}.jpg (CC0 or public
 * domain, credits in CREDITS.md). A photo that fails to load hides itself, so
 * the gradient and the kind's icon behind it are what shows, never a broken
 * image. A portrait photo is shown whole over a blurred copy of itself rather
 * than cropped.
 */
const SLIDES: Record<Kind, readonly { n: number; portrait?: boolean }[]> = {
  cafe: [{ n: 1 }, { n: 2 }, { n: 3 }],
  restaurant: [{ n: 1 }, { n: 2 }, { n: 3 }],
  bakery: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
  bar: [{ n: 1 }, { n: 2 }, { n: 3 }],
  truck: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
};

const AUTOPLAY_MS = 5000;

function UsesCarousel({ kind, Icon, label }: { kind: Kind; Icon: LucideIcon; label: string }) {
  const slides = SLIDES[kind];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduced || slides.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  const go = (to: number) => setIndex((to + slides.length) % slides.length);

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="group relative order-1 min-h-[260px] overflow-hidden md:order-2 md:min-h-[460px]"
      style={{ backgroundImage: aurora({ x: 70, y: 105 }) }}
    >
      <Icon
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 text-white/15"
        strokeWidth={1.25}
      />
      {slides.map((slide, i) => {
        const src = `/images/uses/${kind}-${slide.n}.jpg`;
        const active = i === index;
        return (
          <div
            key={src}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
              active ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {!failed[slide.n] && (
              <>
                {slide.portrait && (
                  /* eslint-disable-next-line @next/next/no-img-element -- decorative blurred backdrop */
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-2xl"
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- owner-supplied files: a missing one hides itself */}
                <img
                  src={src}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={() => setFailed((f) => ({ ...f, [slide.n]: true }))}
                  className={cn(
                    "absolute inset-0 size-full",
                    slide.portrait ? "object-contain" : "object-cover"
                  )}
                />
              </>
            )}
          </div>
        );
      })}

      {slides.length > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
            {slides.map((slide, i) => (
              <button
                key={slide.n}
                type="button"
                aria-label={`Photo ${i + 1} of ${slides.length}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className="inline-flex size-6 cursor-pointer items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all",
                    i === index ? "w-6 bg-white" : "w-2 bg-white/50"
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function UsesSection() {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<Kind>("cafe");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = KINDS.find((k) => k.kind === active) ?? KINDS[0];
  const Icon = current.icon;
  const trialHref = usePosTrialHref();

  // Arrow keys move between the tabs, as a tablist is expected to.
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = KINDS[(index + step + KINDS.length) % KINDS.length];
    setActive(next.kind);
    tabRefs.current[next.kind]?.focus();
  }

  return (
    <section aria-labelledby="uses-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="uses-title"
          align="center"
          eyebrow={t("redesign.landing.uses.eyebrow")}
          title={t("redesign.landing.uses.title")}
          sub={t("redesign.landing.uses.sub")}
        />

        <div className="mt-10 flex justify-center">
          <div
            data-reveal
            role="tablist"
            aria-label={t("redesign.landing.uses.title")}
            className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.05] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {KINDS.map(({ kind, icon: Icon }, index) => {
              const selected = kind === active;
              return (
                <button
                  key={kind}
                  ref={(el) => {
                    tabRefs.current[kind] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`uses-tab-${kind}`}
                  aria-selected={selected}
                  aria-controls="uses-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    setActive(kind);
                    trackEvent("uses_tab", { kind });
                  }}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  className={cn(
                    "focus-visible:outline-epi-gold-300 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 sm:px-5",
                    selected
                      ? "bg-[linear-gradient(180deg,#f4dc90,#d7b54b_55%,#a97c1c)] text-[#151004]"
                      : "text-epi-cream-50/75 hover:text-epi-cream-50 hover:bg-white/[0.06]"
                  )}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  {t(`redesign.landing.uses.${kind}.tab`)}
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={active}
          id="uses-panel"
          role="tabpanel"
          aria-labelledby={`uses-tab-${active}`}
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 mt-8 grid overflow-hidden rounded-3xl border border-white/10 duration-300 md:grid-cols-2"
        >
          <div className="order-2 flex flex-col justify-center gap-6 p-6 sm:p-10 md:order-1">
            <h3 className="epi-display text-epi-cream-50 m-0 text-[clamp(28px,3.4vw,44px)] leading-[1.05] text-balance">
              {t(`redesign.landing.uses.${active}.card1`)}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {([2, 3, 4] as const).map((n) => (
                <li key={n} className="text-epi-cream-50/85 flex items-start gap-3 text-base">
                  <Check aria-hidden="true" className="text-epi-gold-300 mt-0.5 size-5 shrink-0" />
                  {t(`redesign.landing.uses.${active}.card${n}`)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={trialHref}
                onClick={() => trackEvent("cta_click", { event_label: `uses_trial_${active}` })}
                className={cn(PRIMARY_BUTTON, "gap-2")}
              >
                {t("redesign.landing.uses.start")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href={getLocalizedPath(`/blog/${INDUSTRY_GUIDES[locale][active]}`, locale)}
                onClick={() => trackEvent("uses_guide_click", { kind: active })}
                className="text-epi-gold-300 hover:text-epi-cream-50 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
              >
                {t(`redesign.landing.uses.${active}.guide`)} →
              </Link>
            </div>
          </div>

          <UsesCarousel
            key={active}
            kind={active}
            Icon={Icon}
            label={t(`redesign.landing.uses.${active}.tab`)}
          />
        </div>
      </div>
    </section>
  );
}
