"use client";

/**
 * Countdown Component
 *
 * Landing page countdown timer for EPIDOM launch date.
 * Features flip-board style timer units with brand colors.
 *
 * STATUS: Currently ACTIVE on homepage (see src/app/(marketing)/page.tsx).
 * Countdown target date: November 20, 2025.
 *
 * @component
 */

import { memo } from "react";
import Countdown from "react-countdown";
import { useI18n } from "@/components/lang/i18n-provider";
import { WaitlistDialog } from "@/features/marketing/shared/components/waitlist-dialog";
import { Mail, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Container } from "./container";

export const CountdownComponent = memo(function CountdownComponent() {
  const { t } = useI18n();
  const [isClient, setIsClient] = useState(false);
  /** Target launch date: November 20, 2025 */
  const targetDate = new Date("2025-11-20T00:00:00");

  /** Hydrate client-side to avoid SSR mismatch */
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main className="flex min-h-screen items-center bg-white pt-12 sm:pt-16">
      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8">
        {/* Content wrapper - ultra compact design */}
        <div className="animate-slide-up flex flex-col items-center space-y-3 py-4 text-center sm:space-y-4 sm:py-6">
          {/* Main heading */}
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl md:text-5xl lg:text-6xl text-brand-primary">
            {t("countdown.title")}
          </h1>

          <p className="text-muted-foreground max-w-3xl text-lg leading-relaxed sm:text-xl md:text-2xl">
            {t("countdown.subtitle")}
          </p>

          {/* Countdown timer */}
          <div className="my-6 sm:my-8">
            {isClient ? (
              <Countdown
                date={targetDate}
                renderer={({ days, hours, minutes, seconds }) => (
                  <div className="flex scale-90 gap-2 sm:scale-100 sm:gap-3 md:scale-110 md:gap-4 lg:gap-5">
                    <FlipUnit value={days} label={t("countdown.days")} />
                    <FlipUnit value={hours} label={t("countdown.hours")} />
                    <FlipUnit value={minutes} label={t("countdown.minutes")} />
                    <FlipUnit value={seconds} label={t("countdown.seconds")} />
                  </div>
                )}
              />
            ) : (
              <div className="flex scale-90 gap-2 sm:scale-100 sm:gap-3 md:scale-110 md:gap-4 lg:gap-5">
                <FlipUnit value={0} label={t("countdown.days")} />
                <FlipUnit value={0} label={t("countdown.hours")} />
                <FlipUnit value={0} label={t("countdown.minutes")} />
                <FlipUnit value={0} label={t("countdown.seconds")} />
              </div>
            )}
          </div>

          {/* Target date */}
          <p className="text-muted-foreground text-sm sm:text-base">{t("countdown.targetDate")}</p>

          {/* Contact information - ultra compact */}
          <div className="flex flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:gap-4 sm:text-base">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand-primary" />
              <a
                className="font-medium underline transition-all duration-200 hover:no-underline text-brand-primary"
                href="mailto:mrcaoevan@gmail.com"
              >
                {t("countdown.email")}
              </a>
            </div>

            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-brand-primary" />
              <a
                className="font-medium underline transition-all duration-200 hover:no-underline text-brand-primary"
                href="http://wa.me/33781732386"
              >
                {t("countdown.whatsapp")}
              </a>
            </div>
          </div>

          {/* Waitlist CTA - ultra compact */}
          <div className="mt-4 sm:mt-5">
            <p className="text-muted-foreground mb-3 text-sm sm:text-base">
              {t("countdown.waitlistText")}
            </p>
            <div className="inline-block">
              <WaitlistDialog variant="home" />
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
});

// Flip-board style unit with EPIDOM branding - responsive version
function FlipUnit({ value, label }: { value: number; label: string }) {
  // Format to always show 2 digits (e.g., 02, 05)
  const displayValue = String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center">
      <div className="flex">
        {displayValue.split("").map((digit, i) => (
          <div
            key={i}
            className="relative mx-1 flex h-10 w-8 items-center justify-center rounded-md border-2 bg-white text-sm font-bold shadow-md transition-all duration-300 hover:shadow-lg sm:h-12 sm:w-10 sm:text-base md:h-14 md:w-12 md:text-lg lg:h-16 lg:w-14 lg:text-xl border-brand-primary text-brand-primary"
          >
            {digit}
            {/* Divider line */}
            <div
              className="absolute top-1/2 left-0 w-full border-t"
              style={{ borderColor: "#e5e7eb" }}
            />
          </div>
        ))}
      </div>
      <span className="mt-2 text-sm font-semibold tracking-wider uppercase sm:text-xs text-brand-primary">
        {label}
      </span>
    </div>
  );
}
