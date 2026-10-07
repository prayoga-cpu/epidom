"use client";

import { Suspense, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard, MonitorSmartphone, Store, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { SPACE_SCREENSHOTS } from "../data/media";
import type { BadgePlan } from "../data/problems";
import { PlanBadge, SECONDARY_BUTTON, SectionHeading, TEXT_LINK } from "./landing-ui";
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
 * One app, three spaces: Storefront (free), POS Mode (POS), Back Office
 * (Operations). Each card shows a real screenshot once one is supplied in
 * data/media.ts, and a plain icon until then, never a mockup. The Storefront
 * card links to a real, currently published storefront when there is one; the
 * server page streams that slug in, so the link can arrive after the hero.
 */
export function ThreeSpacesSection({
  exampleStorefrontSlug,
}: {
  exampleStorefrontSlug?: Promise<string | null> | string | null;
}) {
  const { t, locale } = useI18n();

  return (
    <section aria-labelledby="spaces-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="spaces-title"
          eyebrow={t("redesign.landing.spaces.eyebrow")}
          title={t("redesign.landing.spaces.title")}
        />

        <ul className="m-0 mt-12 grid list-none gap-4 p-0 md:grid-cols-3">
          {SPACES.map(({ key, icon: Icon, plan }) => {
            const shot = SPACE_SCREENSHOTS[key];
            return (
              <li
                key={key}
                className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6"
              >
                {shot ? (
                  <Image
                    src={shot.src}
                    alt={shot.alt[locale]}
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="h-auto w-full rounded-2xl border border-white/10"
                  />
                ) : (
                  <span aria-hidden="true" className="epi-logo-tile size-14 [&_svg]:size-6">
                    <Icon />
                  </span>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="epi-display text-epi-cream-50 m-0 text-3xl">
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
                  <Suspense fallback={null}>
                    <LiveExampleLink
                      slug={exampleStorefrontSlug}
                      label={t("redesign.landing.spaces.liveExample")}
                    />
                  </Suspense>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <Link href={getLocalizedPath("/services", locale)} className={SECONDARY_BUTTON}>
            {t("redesign.landing.spaces.cta")}
          </Link>
        </div>
      </div>
    </section>
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
    <a
      href={`/@${value}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${TEXT_LINK} mt-auto`}
    >
      {label}
    </a>
  );
}
