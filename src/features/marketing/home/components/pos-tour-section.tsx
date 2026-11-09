"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import { ArrowRightLeft, ChartColumn, Link2, Smartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import {
  PRODUCT_SCREENS,
  type ProductScreen,
  type ProductScreenKey,
} from "@/features/marketing/shared/content/product-screens";
import { aurora, SectionHeading } from "./landing-ui";

/**
 * The four features owners pick a till for, in the order they matter (a demo
 * shows the first within ten seconds; the last ones prove the till is complete
 * rather than sell it). Each has its own real screen.
 */
const FEATURES: readonly {
  key: string;
  icon: LucideIcon;
  screens: readonly ProductScreenKey[];
}[] = [
  { key: "f1", icon: Smartphone, screens: ["storefrontMenu", "storefrontCheckout"] }, // phone orders
  { key: "f2", icon: ChartColumn, screens: ["backOfficeFinanceTabs"] }, // finance
  { key: "f3", icon: ArrowRightLeft, screens: ["backOfficeStock"] }, // switching from the old POS
  { key: "f4", icon: Link2, screens: ["posCashier"] }, // one link, no app store
];

/**
 * Where the section pins and scrolling drives it. MUST match the media query
 * of .epi-pin-section / .epi-pin-sticky in globals.css (the layout is CSS, so
 * it is right before the page is interactive; this only picks the behaviour).
 * Short screens are left out: the features and their heading need ~640px.
 */
const PIN_QUERY = "(min-width: 1024px) and (min-height: 640px)";

/** Unpinned (phones, short screens): how long a feature stays open before the next opens. */
const AUTO_MS = 8000;

const bodyKey = (key: string) =>
  key === "f1"
    ? onlinePaymentCopyKey(`redesign.posTour.${key}Body`)
    : `redesign.posTour.${key}Body`;

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener("change", notify);
      return () => mq?.removeEventListener("change", notify);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false
  );
}

/**
 * POS Mode up close, as an accordion beside one large picture: the title and
 * the list of features on the left (the open one shows its pitch and a
 * progress line), a gradient stage with that feature's real screen on the
 * right. Shown on the home page and on /products.
 *
 * On a desktop screen it is scroll-driven, as lovable.dev's: the section pins
 * to the screen and the page's scroll walks through the features one by one,
 * each progress line filling with the scroll, so none can be skipped past;
 * once the last one is full the page scrolls on. Picking a feature scrolls to
 * it. Elsewhere (phones, short screens) the features open on their own every
 * few seconds until one is picked, paused while the list is hovered or
 * focused, never with reduced motion.
 *
 * Every screen stays mounted and cross-fades so a change never waits on a
 * download; the hidden ones are aria-hidden. The list follows the ARIA tabs
 * pattern (arrow keys, Home, End).
 */
export function PosTourSection() {
  const { t, locale } = useI18n();
  const pinned = useMediaQuery(PIN_QUERY);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const progress = useRef(0);
  const baseId = useId();
  const current = FEATURES[active];

  // Pinned: the scroll through the section decides the open feature and how
  // far its line has filled. The line is written straight to the element (a
  // CSS variable) so scrolling never re-renders; the open feature only
  // re-renders when it changes.
  useEffect(() => {
    if (!pinned) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const section = sectionRef.current;
      const sticky = stickyRef.current;
      if (!section || !sticky) return;
      const rect = section.getBoundingClientRect();
      const run = rect.height - sticky.getBoundingClientRect().height;
      const share = run > 0 ? Math.min(Math.max(-rect.top / run, 0), 1) : 0;
      const total = share * FEATURES.length;
      const index = Math.min(Math.floor(total), FEATURES.length - 1);
      progress.current = Math.min(total - index, 1);
      fillRef.current?.style.setProperty("--p", String(progress.current));
      setActive(index);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pinned]);

  // The open feature's line, whenever it mounts, starts where the scroll is.
  const setFill = useCallback((el: HTMLDivElement | null) => {
    fillRef.current = el;
    el?.style.setProperty("--p", String(progress.current));
  }, []);

  function choose(index: number) {
    if (pinned) {
      // Scroll to where that feature begins; the scroll handler opens it.
      const section = sectionRef.current;
      const sticky = stickyRef.current;
      if (!section || !sticky) return;
      const rect = section.getBoundingClientRect();
      const run = rect.height - sticky.getBoundingClientRect().height;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: window.scrollY + rect.top + (run * (index + 0.04)) / FEATURES.length,
        behavior: reduce ? "auto" : "smooth",
      });
      return;
    }
    setActive(index);
    setAuto(false);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = FEATURES.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    choose(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="pos-tour-title"
      className="epi-section epi-pin-section"
      style={{ "--pin-steps": FEATURES.length } as React.CSSProperties}
    >
      <div ref={stickyRef} className="epi-pin-sticky">
        <div className="epi-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <div className="flex min-w-0 flex-col gap-10 lg:gap-8">
              <SectionHeading
                id="pos-tour-title"
                eyebrow={t("redesign.posTour.eyebrow")}
                title={t("redesign.posTour.title")}
                sub={t("redesign.posTour.sub")}
              />

              <div
                data-reveal
                role="tablist"
                aria-orientation="vertical"
                aria-label={t("redesign.posTour.tabsLabel")}
                className="lg:mt-auto"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
              >
                {FEATURES.map(({ key, icon: Icon }, index) => {
                  const selected = index === active;
                  return (
                    <div key={key} className="border-b border-white/10 first:border-t">
                      <button
                        ref={(el) => {
                          tabs.current[index] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${baseId}-tab-${key}`}
                        aria-selected={selected}
                        aria-controls={`${baseId}-panel`}
                        aria-describedby={selected ? `${baseId}-body` : undefined}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => choose(index)}
                        onKeyDown={(event) => onTabKeyDown(event, index)}
                        className={cn(
                          "focus-visible:outline-epi-gold-300 flex min-h-12 w-full cursor-pointer items-center gap-3 py-3 text-left text-[17px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                          selected
                            ? "text-epi-cream-50 font-medium"
                            : "text-epi-cream-50/70 hover:text-epi-cream-50"
                        )}
                      >
                        {/* Outline icon at the text's own weight; gold on the open feature. */}
                        <Icon
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className={cn(
                            "size-5 shrink-0 transition-colors",
                            selected && "text-epi-gold-300"
                          )}
                        />
                        {t(`redesign.posTour.${key}Tab`)}
                      </button>

                      {/* Every pitch stays mounted and its height animates open and
                          shut (grid rows 0fr <-> 1fr), as lovable.dev's accordion;
                          a closed one is inert and hidden from screen readers. */}
                      <div
                        aria-hidden={!selected}
                        inert={!selected}
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--epi-ease-out)] motion-reduce:transition-none",
                          selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <div
                          id={selected ? `${baseId}-body` : undefined}
                          // Indented to sit under the title, past the icon (size-5 + gap-3).
                          className="min-h-0 overflow-hidden pl-8"
                        >
                          <p className="text-epi-cream-50/65 m-0 text-[15px] leading-relaxed">
                            {t(bodyKey(key))}
                          </p>
                          {/* The progress line, the open feature's only. Pinned it
                              follows the scroll (--p, 0 to 1); otherwise it fills
                              over AUTO_MS and opens the next feature, and once one
                              is picked by hand it just stays short. */}
                          {selected ? (
                            <div className="relative mt-4 h-px bg-white/10" aria-hidden="true">
                              {pinned ? (
                                <div
                                  ref={setFill}
                                  data-testid="pos-tour-progress"
                                  className="from-epi-gold-300 absolute inset-y-0 left-0 h-[2px] w-full origin-left -translate-y-1/2 scale-x-[var(--p,0)] bg-gradient-to-r to-pink-400"
                                />
                              ) : (
                                <div
                                  key={`${key}-${auto}`}
                                  onAnimationEnd={() => setActive((i) => (i + 1) % FEATURES.length)}
                                  style={{
                                    animationDuration: `${AUTO_MS}ms`,
                                    animationPlayState: paused ? "paused" : "running",
                                  }}
                                  className={cn(
                                    "from-epi-gold-300 absolute inset-y-0 left-0 h-[2px] w-full origin-left -translate-y-1/2 bg-gradient-to-r to-pink-400",
                                    auto
                                      ? "animate-[epi-fill_linear_forwards] motion-reduce:animate-none"
                                      : "w-24"
                                  )}
                                />
                              )}
                            </div>
                          ) : null}
                          <div className="pb-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              data-reveal="scale"
              role="tabpanel"
              id={`${baseId}-panel`}
              aria-labelledby={`${baseId}-tab-${current.key}`}
              style={{ backgroundImage: aurora() }}
              className="epi-pin-stage relative isolate min-h-[340px] min-w-0 overflow-hidden rounded-3xl border border-white/10 sm:min-h-[460px] lg:min-h-[560px]"
            >
              {FEATURES.map(({ key, screens }, index) => (
                <div
                  key={key}
                  aria-hidden={index !== active}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
                    index === active ? "opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  <Stage screens={screens} locale={locale} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One feature's screens on the stage: phones as phones, a crop as a card, a window cut off at the foot. */
function Stage({
  screens,
  locale,
}: {
  screens: readonly ProductScreenKey[];
  locale: "fr" | "en" | "id";
}) {
  const shots = screens.map((key) => PRODUCT_SCREENS[key] as ProductScreen);
  const first = shots[0];

  if (first.device === "phone") {
    return (
      <div className="flex h-full items-end justify-center gap-[4%] px-[6%] pt-[8%]">
        {shots.map((shot, i) => (
          <div
            key={i}
            className="relative aspect-[514/1106] max-h-full min-w-0 flex-1 overflow-hidden rounded-t-[22px] border border-white/20 shadow-2xl"
            style={{ maxWidth: "34%" }}
          >
            <Image
              src={shot.src}
              alt={shot.alt[locale]}
              fill
              sizes="(min-width: 1024px) 220px, 30vw"
              placeholder={shot.src.blurDataURL ? "blur" : "empty"}
              className="object-cover object-top"
            />
          </div>
        ))}
      </div>
    );
  }

  if (first.crop) {
    const { x, y, w, h } = first.crop;
    // Vitest resolves static imports to plain strings, with no size: the captures are 2400 px wide.
    const width = first.src.width ?? 2400;
    const height = first.src.height ?? 1605;
    return (
      <div className="flex h-full items-center justify-center px-[5%]">
        <div
          className="bg-epi-navy-900 relative w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl"
          style={{ aspectRatio: `${w} / ${h}` }}
        >
          <Image
            src={first.src}
            alt={first.alt[locale]}
            width={width}
            height={height}
            sizes="(min-width: 1024px) 60vw, 100vw"
            // Placed so the crop's rectangle fills the card exactly.
            style={{
              position: "absolute",
              maxWidth: "none",
              width: `${(width / w) * 100}%`,
              left: `${(-x / w) * 100}%`,
              top: `${(-y / h) * 100}%`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-[7%] top-[12%] bottom-0">
      <div className="bg-epi-navy-900 relative h-full overflow-hidden rounded-t-2xl border border-b-0 border-white/20 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
        <Image
          src={first.src}
          alt={first.alt[locale]}
          fill
          sizes="(min-width: 1240px) 640px, (min-width: 1024px) 55vw, 100vw"
          placeholder={first.src.blurDataURL ? "blur" : "empty"}
          className="object-cover object-left-top"
        />
      </div>
    </div>
  );
}
