"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

export function TrustBar() {
  const { t } = useI18n();

  const stats = [
    { value: t("home.trustBar.stat1Value"), label: t("home.trustBar.stat1Label") },
    { value: t("home.trustBar.stat2Value"), label: t("home.trustBar.stat2Label") },
    { value: t("home.trustBar.stat3Value"), label: t("home.trustBar.stat3Label") },
  ];

  return (
    <section className="border-y border-neutral-100 bg-white py-12">
      <Container maxWidth="6xl">
        <p className="mb-8 text-center text-sm font-medium tracking-widest text-neutral-400 uppercase">
          {t("home.trustBar.heading")}
        </p>

        {/* Stats row */}
        <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16 lg:gap-24">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-brand-primary text-3xl font-bold lg:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Logo placeholder row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 opacity-40">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-md bg-neutral-200"
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-neutral-300">{t("home.trustBar.logoNote")}</p>
      </Container>
    </section>
  );
}
