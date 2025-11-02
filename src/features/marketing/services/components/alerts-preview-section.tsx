"use client";

/**
 * Alerts Preview Section
 *
 * Showcases alert notifications and monitoring features.
 * Layout: description + small preview 40% (left), large preview 60% (right).
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";

export function AlertsPreviewSection() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 flex items-center overflow-visible bg-white py-8 md:py-4 lg:py-16">
      <div className="services-narrow-container">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-10 lg:items-center lg:gap-8">
          {/* Left Column (40%) - Title + Description + Small Mockup */}
          <div className="space-y-3 md:space-y-5 lg:col-span-4">
            {/* Title */}
            <h2 className="text-section-title" style={{ color: "var(--color-brand-primary)" }}>
              {t("services.alerts.title")}
            </h2>

            {/* Description */}
            <p className="text-description" style={{ color: "var(--color-brand-primary)" }}>
              {t("services.alerts.description")}
            </p>

            {/* Small Mockup */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/alert-1.png"
                alt="Alerts interface small preview"
                fill
                className="object-cover scale-[1.01]"
                quality={85}
              />
            </div>
          </div>

          {/* Right Column (60%) - Large Mockup */}
          <div className="lg:col-span-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/alert-2.png"
                alt="Alerts interface large preview"
                fill
                className="object-cover scale-[1.01]"
                priority={true}
                quality={90}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
