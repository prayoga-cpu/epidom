"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { FaqSection, type FaqItem } from "@/features/marketing/home/components/faq-section";
import { getLocalizedPath } from "@/lib/i18n-routing";

/**
 * /pricing's own questions: the three a buyer asks before paying (trial, plan
 * changes, refunds), then the homepage answers that still matter at this point.
 * Every answer is drawn from the checkout code and the refund policy page.
 */
export function PricingFaq() {
  const { t, locale } = useI18n();

  const items: FaqItem[] = [
    { q: t("redesign.faq.pTrialQ"), a: t("redesign.faq.pTrialA") },
    { q: t("redesign.faq.pSwitchQ"), a: t("redesign.faq.pSwitchA") },
    {
      q: t("redesign.faq.pRefundQ"),
      a: t("redesign.faq.pRefundA"),
      link: {
        href: getLocalizedPath("/refund-policy", locale),
        label: t("redesign.faq.pRefundLink"),
      },
    },
    { q: t("redesign.faq.q1"), a: t("redesign.faq.a1") },
    { q: t("redesign.faq.q3"), a: t("redesign.faq.a3") },
    { q: t("redesign.faq.q5"), a: t("redesign.faq.a5") },
  ];

  return <FaqSection items={items} />;
}
