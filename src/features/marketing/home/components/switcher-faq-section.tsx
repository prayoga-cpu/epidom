"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { NF525_SETTLED } from "../lib/migration";
import { FaqSection, type FaqItem } from "./faq-section";

/**
 * The questions someone leaving another till asks. Its own keys
 * (`redesign.landing.faq`), so /pricing's FAQ, which reuses a few of the old
 * homepage answers, is untouched.
 *
 * "Is Epidom NF525 certified?" (q6) is asked by French buyers, also on the
 * English site, so it shows on both once the attestation can be issued
 * (NF525_SETTLED). The answer says plainly that Epidom is attested, not
 * certified: that is the true answer.
 */
export function SwitcherFaqSection() {
  const { t, locale } = useI18n();
  const questions = NF525_SETTLED && locale !== "id" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const items: FaqItem[] = questions.map((n) => ({
    q: t(`redesign.landing.faq.q${n}`),
    a: t(`redesign.landing.faq.a${n}`),
  }));
  return <FaqSection items={items} />;
}
