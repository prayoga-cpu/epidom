"use client";

/**
 * Tracking Preview Section
 *
 * Showcases active stock tracking features with centered mockup.
 * Full-width layout with centered title and large preview image.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";

export function TrackingPreviewSection() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 flex items-center overflow-visible bg-white py-8 md:py-4 lg:py-16">
      <div className="services-narrow-container">
        {/* Title - Centered */}
        <h2 className="text-section-title mb-6 text-center md:mb-4 lg:mb-12 text-brand-primary">
          {t("services.tracking.title")}
        </h2>

        {/* Description - Centered */}
        {t("services.tracking.description") && (
          <p className="text-description mb-6 text-center md:mb-8 lg:mb-12 text-brand-primary max-w-4xl mx-auto">
            {t("services.tracking.description")}
          </p>
        )}

        {/* Large Mockup - Almost full width */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src="/images/tracking.png"
            alt="Active stock tracking interface"
            fill
            className="object-cover scale-[1.01]"
            priority={true}
            quality={90}
          />
        </div>
      </div>
    </section>
  );
}
