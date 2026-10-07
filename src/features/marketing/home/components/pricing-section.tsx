"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { formatPlanPrice, LOCALE_PRICE_CURRENCY } from "@/lib/constants/plan-pricing";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SectionHeading, TEXT_LINK } from "./landing-ui";

/** "0 €", "$0", "Rp 0": the Free price in each site currency. */
const FREE_PRICE = { EUR: "0 €", USD: "$0", IDR: "Rp 0" } as const;

/**
 * The four plans. Paid prices come from src/lib/constants/plan-pricing.ts, the
 * same table the /pricing page is tested against and Billing quotes, never
 * from a hardcoded string here. Only POS carries the "most popular" mark, as
 * on /pricing.
 */
export function PricingSection() {
  const { t, locale } = useI18n();
  const currency = LOCALE_PRICE_CURRENCY[locale];
  const trialHref = usePosTrialHref();
  const pricingPath = getLocalizedPath("/pricing", locale);
  const whatsapp = getWhatsAppOptions(locale)[0];

  const tiers = [
    {
      key: "free",
      price: FREE_PRICE[currency],
      period: t("redesign.landing.pricing.forever"),
      href: "/register",
      cta: t("redesign.landing.pricing.freeCta"),
      external: false,
      highlight: false,
    },
    {
      key: "pos",
      price: formatPlanPrice("POS", currency, "monthly"),
      period: t("redesign.landing.pricing.perMonth"),
      href: trialHref,
      cta: t("redesign.landing.pricing.posCta"),
      external: false,
      highlight: true,
    },
    {
      key: "operations",
      price: formatPlanPrice("OPERATIONS", currency, "monthly"),
      period: t("redesign.landing.pricing.perMonth"),
      href: `${pricingPath}#plans`,
      cta: t("redesign.landing.pricing.operationsCta"),
      external: false,
      highlight: false,
    },
    {
      key: "enterprise",
      price: t("redesign.landing.pricing.custom"),
      period: t("redesign.landing.pricing.customPeriod"),
      href: whatsappHref(whatsapp.number),
      cta: t("redesign.landing.pricing.enterpriseCta"),
      external: true,
      highlight: false,
    },
  ] as const;

  return (
    <section aria-labelledby="pricing-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="pricing-title"
          eyebrow={t("redesign.landing.pricing.eyebrow")}
          title={t("redesign.landing.pricing.title")}
        />

        <ul className="m-0 mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <li
              key={tier.key}
              className={cn(
                "relative flex flex-col gap-4 rounded-3xl border p-6",
                tier.highlight
                  ? "border-epi-gold-500/50 from-epi-gold-500/20 to-epi-gold-500/[0.04] bg-gradient-to-br"
                  : "border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="epi-display text-epi-cream-50 m-0 text-3xl">
                  {t(`redesign.landing.plans.${tier.key}`)}
                </h3>
                {tier.highlight ? (
                  <span className="bg-epi-gold-500 text-epi-navy-900 rounded-full px-3 py-1 text-[11px] tracking-[0.12em] uppercase">
                    {t("redesign.pricingPage.mostPopular")}
                  </span>
                ) : null}
              </div>
              <div>
                <div className="epi-display text-epi-cream-50 text-[40px] leading-none">
                  {tier.price}
                </div>
                <div className="text-epi-cream-50/55 mt-1 text-xs tracking-[0.04em]">
                  {tier.period}
                </div>
              </div>
              <p className="text-epi-cream-50/70 m-0 text-sm leading-relaxed">
                {t(`redesign.landing.pricing.${tier.key}Desc`)}
              </p>
              <div className="mt-auto pt-2">
                {tier.external ? (
                  <a
                    href={tier.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(SECONDARY_BUTTON, "w-full")}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <Link
                    href={tier.href}
                    className={cn(tier.highlight ? PRIMARY_BUTTON : SECONDARY_BUTTON, "w-full")}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-epi-cream-50/70 m-0 text-sm">{t("redesign.landing.pricing.footer")}</p>
          <Link href={pricingPath} className={TEXT_LINK}>
            {t("redesign.landing.pricing.fullComparison")}
          </Link>
        </div>
      </div>
    </section>
  );
}
