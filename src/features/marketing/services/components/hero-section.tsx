"use client";

/**
 * Services Hero Section
 *
 * Hero banner for services page with title and feature highlights.
 * Grid layout: text content (left) + feature block (right).
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 overflow-visible bg-white py-8 md:py-4 lg:py-16">
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 items-center gap-6 md:gap-6 lg:grid-cols-12">
          {/* Left Column - Text Content */}
          <div className="space-y-3 md:space-y-5 lg:col-span-8">
            <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl text-brand-primary">
              {t("services.heroTitle")}
            </h1>

            <p className="max-w-4xl text-lg leading-relaxed md:text-2xl text-brand-primary">
              {t("services.heroDesc")}
            </p>
          </div>

          {/* Right Column - Feature Block */}
          <div className="flex justify-center lg:col-span-4">
            <div className="w-full md:w-fit">
              <div className="rounded-2xl p-6 text-left text-white md:p-8 bg-brand-primary">
                <div className="space-y-4 md:space-y-5">
                  <div className="text-lg font-semibold md:text-xl lg:text-2xl">
                    {t("services.featureBlock.management")}
                  </div>
                  <div className="text-lg font-semibold md:text-xl lg:text-2xl">
                    {t("services.featureBlock.tracking")}
                  </div>
                  <div className="text-lg font-semibold md:text-xl lg:text-2xl">
                    {t("services.featureBlock.data")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
