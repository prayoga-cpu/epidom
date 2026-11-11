"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import {
  LOCALE_PRICE_CURRENCY,
  formatPlanPrice,
  type PriceCurrency,
} from "@/lib/constants/plan-pricing";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { NF525_SETTLED } from "../lib/migration";
import { FaqSection, type FaqItem } from "./faq-section";

/**
 * The home page's questions, in the order they block a sign-up: what it costs,
 * whether the old till has to go, whether the menu comes across, how customers
 * pay, then the doubts (offline, hardware, data, the trial's end), then two
 * a café owner would not think to ask (Claude, staff clock-in). Its own keys
 * (`redesign.landing.faq`), so /pricing's FAQ, which reuses a few of the old
 * homepage answers, is untouched.
 *
 * - The cost answer (q7) writes no price itself: its {pos}, {posYear}, {ops}
 *   and {opsYear} are filled from PLAN_PRICING in the visitor's currency, so a
 *   price change is made in one place (src/lib/constants/plan-pricing.ts).
 * - The payment answer (q9) has a "pay at the counter" twin, picked by
 *   onlinePaymentCopyKey, so it never promises online payment the storefront
 *   does not offer.
 * - "Is Epidom NF525 certified?" (q6) is asked by French buyers, also on the
 *   English site, so it shows on both once the attestation can be issued
 *   (NF525_SETTLED). The answer says plainly that Epidom is attested, not
 *   certified: that is the true answer.
 *
 * Each item has an id, so a link can open it: /#faq-offline (support sends
 * these on WhatsApp).
 */
const ORDER = [
  { n: 7, id: "cost" },
  { n: 1, id: "switch" },
  { n: 8, id: "import" },
  { n: 9, id: "pay" },
  { n: 3, id: "offline" },
  { n: 4, id: "hardware" },
  { n: 2, id: "data" },
  { n: 5, id: "trial" },
  { n: 10, id: "claude" },
  { n: 11, id: "staff" },
] as const;

/** The plan prices as the cost answer quotes them, in the visitor's currency. */
function planPrices(currency: PriceCurrency) {
  return {
    pos: formatPlanPrice("POS", currency, "monthly"),
    posYear: formatPlanPrice("POS", currency, "yearly"),
    ops: formatPlanPrice("OPERATIONS", currency, "monthly"),
    opsYear: formatPlanPrice("OPERATIONS", currency, "yearly"),
  };
}

export function SwitcherFaqSection() {
  const { t, locale } = useI18n();
  const prices = planPrices(LOCALE_PRICE_CURRENCY[locale]);
  const fill = (text: string) =>
    text.replace(/\{(pos|posYear|ops|opsYear)\}/g, (_, key: keyof typeof prices) => prices[key]);

  const pageHref = (slug: string | undefined) =>
    getLocalizedPath(slug ? `/${slug}` : "/pricing", locale);
  const links: Partial<Record<number, { href: string; label: string }>> = {
    7: { href: getLocalizedPath("/pricing", locale), label: t("redesign.landing.faq.linkPricing") },
    3: {
      href: pageHref(LANDING_GROUPS.offline[locale]),
      label: t("redesign.landing.faq.linkOffline"),
    },
    10: {
      href: pageHref(LANDING_GROUPS["claude-connector"][locale]),
      label: t("redesign.landing.faq.linkClaude"),
    },
  };

  const rows: { n: number; id: string }[] = [...ORDER];
  if (NF525_SETTLED && locale !== "id") rows.push({ n: 6, id: "nf525" });

  const items: FaqItem[] = rows.map(({ n, id }) => ({
    id,
    q: t(`redesign.landing.faq.q${n}`),
    a: fill(
      t(n === 9 ? onlinePaymentCopyKey("redesign.landing.faq.a9") : `redesign.landing.faq.a${n}`)
    ),
    link: links[n],
  }));
  return <FaqSection items={items} trialCta />;
}
