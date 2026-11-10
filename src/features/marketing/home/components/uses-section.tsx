"use client";

import { useRef, useState } from "react";
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
import { LANDING_GROUPS, type LandingGroup } from "@/features/marketing/landing/registry";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { aurora, LIGHT_BUTTON, SectionHeading } from "./landing-ui";

type Kind = "cafe" | "restaurant" | "bakery" | "bar" | "truck";

/**
 * Where each card of a business type goes: a landing page group, or null for
 * the services page. A group with no page in the visitor's language also falls
 * back to /products, so a card never links to a page that does not exist.
 */
const KINDS: readonly {
  kind: Kind;
  icon: LucideIcon;
  links: readonly [
    LandingGroup | null,
    LandingGroup | null,
    LandingGroup | null,
    LandingGroup | null,
  ];
}[] = [
  { kind: "cafe", icon: Coffee, links: ["online-ordering", "cafe", "recipe-cost", "offline"] },
  {
    kind: "restaurant",
    icon: ChefHat,
    links: ["online-ordering", "restaurant", "kitchen-display", "stock-recipes"],
  },
  {
    kind: "bakery",
    icon: Croissant,
    links: ["online-ordering", "bakery", "stock-recipes", "recipe-cost"],
  },
  { kind: "bar", icon: Beer, links: ["online-ordering", null, "receipt-printer", "recipe-cost"] },
  { kind: "truck", icon: Truck, links: ["qr-menu", null, "offline", null] },
];

/**
 * "What is Epidom used for?": a tab per kind of food and drink business and,
 * under it, ONE card: a photo of that kind of place beside one headline, three
 * short ticks and one action (the live demo, in a new tab). F&B only.
 *
 * The photos are files in public/images/uses/ (cafe, restaurant, bakery, bar,
 * truck .jpg), chosen by the owner (a licensed stock photo or their own).
 * Until a file exists the card shows the site's gradient and the kind's icon,
 * so nothing is ever broken.
 */
export function UsesSection() {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<Kind>("cafe");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = KINDS.find((k) => k.kind === active) ?? KINDS[0];
  const Icon = current.icon;

  function hrefFor(group: LandingGroup | null) {
    const slug = group
      ? (LANDING_GROUPS[group] as Partial<Record<typeof locale, string>>)[locale]
      : undefined;
    return getLocalizedPath(slug ? `/${slug}` : "/products", locale);
  }

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
              <a
                href="/demo/phone-orders"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("uses_demo_click", { kind: active })}
                className={cn(LIGHT_BUTTON, "gap-2")}
              >
                {t("redesign.landing.spaces.demoOpen")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              <Link
                href={hrefFor(current.links[0])}
                onClick={() => trackEvent("uses_card_click", { kind: active, card: 1 })}
                className="text-epi-gold-300 hover:text-epi-cream-50 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
              >
                {t("redesign.landing.uses.cta1")} →
              </Link>
            </div>
          </div>

          <div
            className="relative order-1 min-h-[240px] md:order-2 md:min-h-[420px]"
            style={{ backgroundImage: aurora({ x: 70, y: 105 }) }}
          >
            <Icon
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 text-white/15"
              strokeWidth={1.25}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- an optional owner-supplied file: a missing one hides itself */}
            <img
              src={`/images/uses/${active}.jpg`}
              alt=""
              loading="lazy"
              onError={(event) => (event.currentTarget.style.display = "none")}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
