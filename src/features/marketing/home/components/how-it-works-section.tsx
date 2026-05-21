"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

const STEPS = [
  { num: "01", titleKey: "home.howItWorks.step1Title", descKey: "home.howItWorks.step1Desc" },
  { num: "02", titleKey: "home.howItWorks.step2Title", descKey: "home.howItWorks.step2Desc" },
  { num: "03", titleKey: "home.howItWorks.step3Title", descKey: "home.howItWorks.step3Desc" },
] as const;

export function HowItWorksSection() {
  const { t } = useI18n();

  return (
    <section className="bg-white py-24">
      <Container maxWidth="6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("home.howItWorks.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-xl text-lg leading-[1.7]">
            {t("home.howItWorks.subheadline")}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
          {STEPS.map(({ num, titleKey, descKey }, i) => (
            <div key={num} className="relative flex flex-col items-center text-center sm:items-start sm:text-left">
              {/* Connector line (desktop only) */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-8 left-[calc(50%+2rem)] hidden h-px w-[calc(100%-4rem)] bg-neutral-100 sm:block" style={{ left: "calc(3.5rem + 1rem)", width: "calc(100% - 3.5rem - 2rem)" }} />
              )}

              {/* Step number */}
              <div className="bg-bg-warm text-brand-primary/20 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold tracking-tight">
                {num}
              </div>

              <h3 className="text-brand-primary mb-2 text-lg font-semibold">{t(titleKey)}</h3>
              <p className="text-brand-primary/60 text-sm leading-[1.7]">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
