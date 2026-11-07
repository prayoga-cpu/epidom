"use client";

import { Suspense, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  LayoutDashboard,
  MonitorSmartphone,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { SPACE_SCREENSHOTS } from "../data/media";
import type { ProductScreen } from "@/features/marketing/shared/content/product-screens";
import type { BadgePlan } from "../data/problems";
import { cn } from "@/lib/utils";
import {
  CARD,
  CARD_INTERACTIVE,
  PlanBadge,
  SECONDARY_BUTTON,
  SectionHeading,
  TEXT_LINK,
} from "./landing-ui";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";

const SPACES: readonly {
  key: keyof typeof SPACE_SCREENSHOTS;
  icon: LucideIcon;
  plan: BadgePlan;
}[] = [
  { key: "storefront", icon: Store, plan: "FREE" },
  { key: "pos", icon: MonitorSmartphone, plan: "POS" },
  { key: "backOffice", icon: LayoutDashboard, plan: "OPERATIONS" },
];

/**
 * "One order, three steps": the three spaces told as what happens to one
 * order. 1. The customer orders on Phone Orders (free); 2. it lands on the
 * till and prints in the kitchen (POS); 3. stock and profit update in the
 * Store Dashboard (Operations). It replaced both the "three spaces" cards and
 * the nine-tile hub diagram (2026-11-06), so the Claude connector is a line
 * under the steps. Each card shows the real screenshot set in data/media.ts,
 * or a plain icon, never a mockup. The first card links to a real, currently
 * published storefront when there is one; the server page streams that slug
 * in, so the link can arrive after the hero.
 */
export function ThreeSpacesSection({
  exampleStorefrontSlug,
}: {
  exampleStorefrontSlug?: Promise<string | null> | string | null;
}) {
  const { t, locale } = useI18n();
  // The Claude connector page, in the visitor's language (else the products page).
  const connectorSlug = LANDING_GROUPS["claude-connector"][locale];

  return (
    <section aria-labelledby="spaces-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="spaces-title"
          eyebrow={t("redesign.landing.spaces.eyebrow")}
          title={t("redesign.landing.spaces.title")}
          sub={t("redesign.landing.spaces.sub")}
        />

        <ol className="m-0 mt-12 grid list-none gap-8 p-0 md:grid-cols-3 md:gap-6">
          {SPACES.map(({ key, icon: Icon, plan }, index) => {
            const shot = SPACE_SCREENSHOTS[key];
            const last = index === SPACES.length - 1;
            return (
              <li
                key={key}
                data-reveal
                className={cn(CARD, CARD_INTERACTIVE, "relative flex flex-col gap-5 p-6")}
              >
                {/* What happens next: right on a wide screen, down on a phone. */}
                {!last ? (
                  <span
                    aria-hidden="true"
                    className="bg-epi-navy-900 text-epi-gold-300 absolute -bottom-[34px] left-1/2 z-10 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 md:top-1/2 md:-right-[30px] md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2"
                  >
                    <ArrowDown className="size-4 md:hidden" />
                    <ArrowRight className="hidden size-4 md:block" />
                  </span>
                ) : null}
                <div>
                  <p className="text-epi-gold-300 m-0 text-xs font-medium tracking-[0.12em] uppercase">
                    {t("redesign.landing.spaces.stepLabel").replace("{n}", String(index + 1))}
                  </p>
                  <p className="text-epi-cream-50 m-0 mt-1.5 text-lg leading-snug font-medium">
                    {t(`redesign.landing.spaces.${key}Step`)}
                  </p>
                </div>
                {shot ? (
                  <SpaceShot shot={shot} alt={shot.alt[locale]} />
                ) : (
                  <span aria-hidden="true" className="epi-logo-tile size-14 [&_svg]:size-6">
                    <Icon />
                  </span>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="epi-display text-epi-cream-50 m-0 text-2xl">
                    {t(`redesign.landing.spaces.${key}Name`)}
                  </h3>
                  <PlanBadge plan={plan} />
                </div>
                <p className="text-epi-cream-50/75 m-0 text-[15px] leading-relaxed">
                  {t(
                    key === "storefront"
                      ? onlinePaymentCopyKey("redesign.landing.spaces.storefrontBody")
                      : `redesign.landing.spaces.${key}Body`
                  )}
                </p>
                {key === "storefront" && exampleStorefrontSlug ? (
                  // The link's place is held before its streamed slug arrives:
                  // the calculator sits right below this section, and Safari
                  // (no scroll anchoring) would otherwise push it 64px down after
                  // the picker's calculator button has scrolled to it.
                  <div
                    data-testid="live-example-slot"
                    className="mt-auto flex min-h-11 items-center"
                  >
                    <Suspense fallback={null}>
                      <LiveExampleLink
                        slug={exampleStorefrontSlug}
                        label={t("redesign.landing.spaces.liveExample")}
                      />
                    </Suspense>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <Link href={getLocalizedPath("/products", locale)} className={SECONDARY_BUTTON}>
            {t("redesign.landing.spaces.cta")}
          </Link>
          <Link
            href={getLocalizedPath(connectorSlug ? `/${connectorSlug}` : "/products", locale)}
            onClick={() =>
              trackEvent("claude_promo_click", {
                event_category: "claude_connector",
                surface: "home_steps",
              })
            }
            className={TEXT_LINK}
          >
            {t("redesign.landing.spaces.claude")} →
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * A 16:10 window on a space's screenshot, so the three cards line up whatever
 * the capture's shape. A phone capture stands in it as a phone, cut off at the
 * bottom; a desktop capture fills it from the top-left corner.
 */
export function SpaceShot({ shot, alt }: { shot: ProductScreen; alt: string }) {
  const placeholder = shot.src.blurDataURL ? "blur" : "empty";
  return (
    <div className="bg-epi-navy-900 relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(217,174,59,0.16),transparent_65%)]">
      {shot.device === "phone" ? (
        <div className="absolute top-4 left-1/2 aspect-[514/1106] w-[44%] -translate-x-1/2 overflow-hidden rounded-t-[20px] border border-white/15 shadow-2xl">
          <Image
            src={shot.src}
            alt={alt}
            fill
            sizes="(min-width: 768px) 160px, 45vw"
            placeholder={placeholder}
            className="object-cover object-top"
          />
        </div>
      ) : (
        <Image
          src={shot.src}
          alt={alt}
          fill
          sizes="(min-width: 1240px) 380px, (min-width: 768px) 33vw, 100vw"
          placeholder={placeholder}
          className="object-cover object-left-top"
        />
      )}
    </div>
  );
}

/** The link to a live storefront, once the streamed slug arrives (none if it is null). */
function LiveExampleLink({
  slug,
  label,
}: {
  slug: Promise<string | null> | string;
  label: string;
}) {
  const value = typeof slug === "string" ? slug : use(slug);
  if (!value) return null;
  return (
    <a href={`/@${value}`} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
      {label}
    </a>
  );
}
