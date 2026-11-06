"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Beer,
  ChefHat,
  Coffee,
  CookingPot,
  Croissant,
  Truck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANDING_GROUPS, type LandingGroup } from "@/features/marketing/landing/registry";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { SPACE_SCREENSHOTS } from "../data/media";
import { aurora, LIGHT_BUTTON, SectionHeading } from "./landing-ui";
import { SpaceShot } from "./three-spaces-section";

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
 * The four slots of the bento grid: a wide and a narrow card, then a narrow and
 * a wide one. All four wear the site's one accent gradient (aurora), its glow
 * moved per card so the grid doesn't read as four copies.
 */
const SLOTS = [
  { span: "lg:col-span-8", glow: { x: 30, y: 110 }, icon: CookingPot, shot: "storefront" },
  { span: "lg:col-span-4", glow: { x: 75, y: 110 }, icon: Coffee, shot: "pos" },
  { span: "lg:col-span-4", glow: { x: 20, y: 105 }, icon: ChefHat, shot: null },
  { span: "lg:col-span-8", glow: { x: 80, y: 108 }, icon: WifiOff, shot: null },
] as const;

/**
 * "What is Epidom used for?": a tab per kind of food and drink business, and
 * under it four cards, each one thing Epidom does for that business and where
 * to read more. F&B only. The first two cards show the real screens (the
 * Phone Orders page, the till), the other two stay plain.
 */
export function UsesSection() {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<Kind>("cafe");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = KINDS.find((k) => k.kind === active) ?? KINDS[0];

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
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 mt-8 grid gap-4 duration-300 lg:grid-cols-12"
        >
          {SLOTS.map((slot, i) => {
            const shot = slot.shot ? SPACE_SCREENSHOTS[slot.shot] : null;
            const Icon = i === 1 ? current.icon : slot.icon;
            return (
              <article
                key={i}
                data-reveal
                style={{ backgroundImage: aurora(slot.glow) }}
                className={cn(
                  "relative flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-white/10 p-6 text-white sm:p-8",
                  slot.span
                )}
              >
                <div className="relative z-10 flex flex-col items-start gap-5">
                  <h3 className="m-0 max-w-[22ch] text-2xl leading-tight font-medium text-balance sm:text-[28px]">
                    {t(`redesign.landing.uses.${active}.card${i + 1}`)}
                  </h3>
                  <Link
                    href={hrefFor(current.links[i])}
                    onClick={() => trackEvent("uses_card_click", { kind: active, card: i + 1 })}
                    className={LIGHT_BUTTON}
                  >
                    {t(`redesign.landing.uses.cta${i + 1}`)}
                  </Link>
                </div>

                {shot ? (
                  <div className="relative z-10 -mb-2 sm:-mr-2">
                    <SpaceShot shot={shot} alt={shot.alt[locale]} />
                  </div>
                ) : (
                  <Icon
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-4 -bottom-6 size-40 text-white/15 sm:size-52"
                    strokeWidth={1.25}
                  />
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
