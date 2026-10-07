"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { trackEvent } from "@/lib/analytics";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from "./landing-ui";

/**
 * The close: the POS trial, or a WhatsApp conversation. No email field; there
 * is no lead backend for it to write to.
 */
export function FinalCtaSection() {
  const { t, locale } = useI18n();
  const trialHref = usePosTrialHref();
  const whatsapp = getWhatsAppOptions(locale)[0];

  return (
    <section aria-labelledby="final-cta-title" className="pt-16 pb-20 sm:pt-24 sm:pb-24">
      <div className="epi-container">
        <div className="from-epi-navy-800 to-epi-navy-900 relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-br px-6 py-14 text-center sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-1/2 left-1/2 size-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(217,174,59,0.2),transparent_60%)]"
          />
          <div className="relative">
            <h2
              id="final-cta-title"
              className="epi-display text-epi-cream-50 m-0 text-[clamp(40px,6vw,88px)] leading-[0.92]"
            >
              {t("redesign.landing.finalCta.title")}
            </h2>
            <p className="text-epi-cream-50/75 mx-auto mt-5 max-w-xl text-lg">
              {t("redesign.landing.finalCta.sub")}
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href={trialHref}
                onClick={() => trackEvent("cta_click", { event_label: "final_trial" })}
                className={PRIMARY_BUTTON}
              >
                {t("redesign.landing.finalCta.trial")}
              </Link>
              <a
                href={whatsappHref(whatsapp.number)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", { event_label: "final_whatsapp" })}
                className={SECONDARY_BUTTON}
              >
                {t("redesign.landing.finalCta.whatsapp")}
              </a>
            </div>
            <Link href="/register" className={`${TEXT_LINK} mt-4`}>
              {t("redesign.landing.finalCta.freePage")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
