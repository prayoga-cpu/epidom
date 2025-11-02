"use client";

import { Button } from "@/components/ui/button";
import { DynamicWaitlistDialog } from "@/lib/dynamic-imports.client";
import { useI18n } from "@/components/lang/i18n-provider";

export function PricingCta() {
  const { t } = useI18n();

  const handleViewPlansClick = () => {
    // Track click for analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "view_plans_click", {
        event_category: "engagement",
        event_label: "pricing_cta",
        value: 1,
      });
    }

    // Smooth scroll to pricing cards section
    const pricingCardsElement = document.querySelector('[data-section="pricing-cards"]');
    if (pricingCardsElement) {
      // Calculate offset based on screen size for better visibility
      const isMobile = window.innerWidth < 768;
      const offset = isMobile ? 100 : 150; // More offset on desktop, less on mobile

      // Get element position and add offset for better visibility
      const elementPosition = pricingCardsElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="pb-10 md:pb-12 lg:pb-16">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <div className="bg-muted/30 rounded-2xl border-2 p-6 text-center md:p-8 lg:p-12">
          <h3 className="text-xl font-bold tracking-tight md:text-3xl">
            {t("pricing.finalCta.title")}
          </h3>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base">
            {t("pricing.finalCta.desc")}
          </p>
          <div className="mt-6 flex flex-col flex-wrap items-center justify-center gap-3 md:flex-row">
            <DynamicWaitlistDialog />
            <Button
              variant="secondary"
              className="rounded-lg transition-colors duration-200 hover:bg-gray-200 hover:shadow-md"
              style={{ color: "var(--color-brand-primary)" }}
              onClick={handleViewPlansClick}
            >
              {t("pricing.finalCta.goPayments")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
