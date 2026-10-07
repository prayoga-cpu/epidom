"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { SECONDARY_BUTTON } from "./landing-ui";

/**
 * "How we compare": a pointer to the /compare hub. The body names only
 * competitors whose page is written in that language (Zelty, SumUp and Sunday
 * in fr and en; Moka, Majoo and Klikit in id).
 */
export function ComparisonTeaserSection() {
  const { t, locale } = useI18n();

  return (
    <section aria-labelledby="compare-title" className="py-6 sm:py-10">
      <div className="epi-container">
        <div className="from-epi-navy-800 to-epi-navy-900 flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-br p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="epi-eyebrow mb-3">{t("redesign.landing.compare.eyebrow")}</div>
            <h2
              id="compare-title"
              className="epi-display text-epi-cream-50 m-0 text-[clamp(32px,4vw,52px)] leading-[0.95]"
            >
              {t("redesign.landing.compare.title")}
            </h2>
            <p className="text-epi-cream-50/70 m-0 mt-4 text-base leading-relaxed">
              {t("redesign.landing.compare.body")}
            </p>
          </div>
          <Link
            href={getLocalizedPath("/compare", locale)}
            className={`${SECONDARY_BUTTON} shrink-0`}
          >
            {t("redesign.landing.compare.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
