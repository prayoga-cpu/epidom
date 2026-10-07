"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { FaqSection, type FaqItem } from "./faq-section";

/**
 * The questions someone leaving another till asks. Its own keys
 * (`redesign.landing.faq`), so /pricing's FAQ, which reuses a few of the old
 * homepage answers, is untouched.
 *
 * "Is Epidom NF525 compliant?" belongs here too, but only once there is a true
 * answer to give: add it when NF525_SETTLED (lib/migration.ts) flips, not before.
 */
export function SwitcherFaqSection() {
  const { t } = useI18n();
  const items: FaqItem[] = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`redesign.landing.faq.q${n}`),
    a: t(`redesign.landing.faq.a${n}`),
  }));
  return <FaqSection items={items} />;
}
