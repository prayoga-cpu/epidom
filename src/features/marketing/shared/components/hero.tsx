"use client";

/**
 * Hero Section Component
 *
 * Main hero section for homepage with split layout:
 * - Desktop: 50/50 split with image left, content right
 * - Mobile/Tablet: Full-width image above content
 * Features lazy-loading image with priority on first viewport.
 *
 * @component
 */

import Image from "next/image";
import { WaitlistDialog } from "./waitlist-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Helper component for Image with Skeleton loading state
const HeroImage = ({
  className,
  sizes,
  priority = false,
}: {
  className?: string;
  sizes: string;
  priority?: boolean;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {isLoading && (
        <Skeleton className="bg-muted/60 absolute inset-0 z-10 h-full w-full animate-pulse" />
      )}
      <Image
        src="/images/pantry-shelf.jpg"
        alt="Pantry shelves with jars and baskets"
        fill
        className={cn(
          "object-cover transition-opacity duration-700 ease-in-out",
          isLoading ? "scale-[1.02] opacity-0" : "scale-100 opacity-100"
        )}
        sizes={sizes}
        priority={priority}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

export const Hero = React.memo(function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative grid min-h-screen overflow-hidden bg-white py-8 md:py-12 lg:h-screen lg:grid-cols-2 lg:pt-16 lg:pb-0">
      {/* Image Column - 50% Left (Desktop only) - Full width, no padding */}
      <div className="relative hidden w-full lg:block lg:h-[calc(100vh-4rem)]">
        <HeroImage sizes="50vw" priority />
      </div>

      {/* Content Column - 50% Right (Desktop) / Full Width (Mobile/Tablet) */}
      <div className="flex w-full flex-col lg:h-[calc(100vh-4rem)]">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-8 md:py-12 lg:ml-0 lg:flex lg:h-full lg:flex-col lg:justify-center lg:px-8 lg:py-0">
          {/* Wrapper untuk semua konten teks - di-center vertikal di desktop */}
          <div className="w-full space-y-4 md:space-y-5">
            {/* Mobile/Tablet Image */}
            <div className="relative mt-[32px] aspect-[4/3] w-full overflow-hidden rounded-xl shadow-md md:mt-0 lg:mt-0 lg:hidden">
              <HeroImage sizes="100vw" priority />
            </div>

            {/* Title and Subtitle */}
            <div className="space-y-2 md:space-y-3">
              <h1 className="text-brand-primary text-5xl leading-tight font-bold tracking-tight md:text-6xl lg:text-5xl xl:text-6xl">
                {t("hero.title")}
              </h1>
              <p className="text-brand-primary text-2xl leading-relaxed font-medium text-balance md:text-3xl lg:text-2xl">
                {t("hero.subtitle")}
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-1 md:pt-0 lg:pt-0">
              <WaitlistDialog variant="home" />
            </div>

            {/* Description */}
            <div className="space-y-3 text-lg leading-relaxed text-gray-600 md:text-xl lg:text-lg">
              <p>{t("hero.p1")}</p>
              <p>{t("hero.p2")}</p>
              <p>{t("hero.p3")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
