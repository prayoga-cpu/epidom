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
import React from "react";

export const Hero = React.memo(function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative grid min-h-screen overflow-hidden bg-white py-8 md:py-12 lg:grid-cols-2 lg:pt-16 lg:pb-0 lg:h-screen">
      {/* Image Column - 50% Left (Desktop only) - Full width, no padding */}
      <div className="relative hidden w-full lg:block lg:h-[calc(100vh-4rem)]">
        <Image
          src="/images/pantry-shelf.jpg"
          alt="Pantry shelves with jars and baskets"
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
      </div>

      {/* Content Column - 50% Right (Desktop) / Full Width (Mobile/Tablet) */}
      <div className="flex w-full flex-col lg:h-[calc(100vh-4rem)]">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-8 md:py-12 lg:ml-0 lg:px-8 lg:py-0 lg:flex lg:flex-col lg:justify-center lg:h-full">
          {/* Wrapper untuk semua konten teks - di-center vertikal di desktop */}
          <div className="w-full space-y-4 md:space-y-5">
            {/* Mobile/Tablet Image */}
            <div className="relative mt-[32px] aspect-[4/3] w-full overflow-hidden rounded-xl shadow-md md:mt-0 lg:hidden lg:mt-0">
              <Image
                src="/images/pantry-shelf.jpg"
                alt="Pantry shelves with jars and baskets"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            </div>

            {/* Title and Subtitle */}
            <div className="space-y-2 md:space-y-3">
              <h1 className="text-5xl leading-tight font-bold tracking-tight md:text-6xl lg:text-5xl xl:text-6xl text-brand-primary">
                {t("hero.title")}
              </h1>
              <p className="text-2xl leading-relaxed font-medium text-balance md:text-3xl lg:text-2xl text-brand-primary">
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
