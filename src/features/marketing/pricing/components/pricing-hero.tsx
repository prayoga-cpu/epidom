"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

export function PricingHero() {
  const { t } = useI18n();

  return (
    <section className="bg-bg-warm py-16 md:py-20 lg:py-24">
      <Container maxWidth="4xl">
        <div className="text-center">
          <span className="mb-5 inline-block rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-brand-primary/70 shadow-sm">
            {t("home.pricing.ribbon")}
          </span>
          <h1 className="mb-5 text-3xl font-bold leading-tight text-brand-primary sm:text-4xl lg:text-5xl">
            {t("pricing.heroTitle")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-[1.7] text-brand-primary/60">
            {t("pricing.heroDescription")}
          </p>
        </div>
      </Container>
    </section>
  );
}
