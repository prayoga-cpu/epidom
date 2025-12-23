"use client";

/**
 * Pricing CTA Component
 *
 * Final call-to-action section on pricing page.
 * Features waitlist signup and smooth scroll to pricing cards.
 *
 * @component
 */

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

export function PricingCta() {
  const { t } = useI18n();

  const handleViewPlansClick = () => {
    // Track click for analytics
    import("@/lib/analytics").then(({ trackEvent }) => {
      trackEvent("view_plans_click", {
        event_category: "engagement",
        event_label: "pricing_cta",
        value: 1,
      });
    });

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
      <Container maxWidth="7xl">
        {/* Cookie Bar Style CTA - Premium Floating Box */}
        <div className="mx-auto max-w-4xl relative">
           {/* Decorative blurred glow backdrop */}
           <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-75" />

           <div className="relative bg-gray-900 rounded-2xl p-6 md:p-10 shadow-2xl border border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8 text-left">
              <div className="flex-1 space-y-4">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 w-fit">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-medium text-white/90">Premium Feature</span>
                 </div>

                 <div>
                    <h3 className="text-2xl font-bold tracking-tight text-white md:text-3xl mb-2">
                       Ready to Upgrade Your Kitchen?
                    </h3>
                    <p className="text-gray-400 text-sm md:text-base max-w-lg leading-relaxed">
                       {t("pricing.finalCta.desc")}
                    </p>
                 </div>

                 <div className="flex flex-wrap gap-4 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1.5">
                       <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       Instant Setup
                    </span>
                    <span className="flex items-center gap-1.5">
                       <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       Cancel Anytime
                    </span>
                    <span className="flex items-center gap-1.5">
                       <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       Secure Payment
                    </span>
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                 <Button
                    size="lg"
                    className="h-10 rounded-full px-6 font-semibold bg-white text-brand-primary hover:bg-gray-100 transition-colors w-full sm:w-auto min-w-[140px]"
                    onClick={() => window.open("https://calendly.com/prayogadevelopment/30min", "_blank")}
                 >
                    Book 1:1 Demo
                 </Button>

                 <Button
                    variant="ghost"
                    className="h-10 rounded-full px-6 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-semibold w-full sm:w-auto border border-transparent hover:border-gray-700"
                    onClick={handleViewPlansClick}
                 >
                    {t("pricing.finalCta.goPayments")}
                 </Button>
              </div>
           </div>
        </div>
      </Container>
    </section>
  );
}
