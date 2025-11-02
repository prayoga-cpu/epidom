"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

export function ManagementRowOne() {
  const { t } = useI18n();
  const { ref, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "50px",
    triggerOnce: true,
  });

  return (
    <section
      ref={ref}
      className="relative z-10 flex items-center overflow-visible bg-white py-8 md:py-4 lg:py-16"
    >
      <div className="services-narrow-container">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-10 lg:items-center lg:gap-8">
          {/* Left Column (40%) - Text + Small Mockup */}
          <div className="space-y-3 md:space-y-5 lg:col-span-4">
            {/* Title */}
            <h2 className="text-section-title" style={{ color: "var(--color-brand-primary)" }}>
              {t("services.management.title")}
            </h2>

            {/* Subtitle */}
            <h3 className="text-subtitle" style={{ color: "var(--color-brand-primary)" }}>
              {t("services.management.subtitle")}
            </h3>

            {/* Description */}
            <p className="text-description" style={{ color: "#444444" }}>
              {t("services.management.description")}
            </p>

            {/* Small Mockup */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              {hasIntersected && (
                <Image
                  src="/images/management-history.png"
                  alt="Production history interface"
                  fill
                  className="object-cover scale-[1.01]"
                  quality={80}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 30vw"
                  loading="lazy"
                />
              )}
            </div>
          </div>

          {/* Right Column (60%) - Large Mockup */}
          <div className="flex items-center lg:col-span-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              {hasIntersected && (
                <Image
                  src="/images/management-editstock.png"
                  alt="Edit stock interface"
                  fill
                  className="object-cover scale-[1.01]"
                  priority={false}
                  quality={85}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 45vw"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
