"use client";

/**
 * How to Use Section - Full-Width Carousel
 *
 * Features displayed one at a time with auto-slide.
 * Screenshots shown in browser mockup for clean presentation.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Bell,
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { SSRPlaceholder } from "@/components/shared";

const FEATURES = [
  {
    key: "dashboard",
    image: "/images/dashboard.png",
    icon: LayoutDashboard,
  },
  {
    key: "management",
    image: "/images/management-reciptprod.png",
    icon: Package,
  },
  {
    key: "tracking",
    image: "/images/tracking.png",
    icon: TrendingUp,
  },
  {
    key: "data",
    image: "/images/data-material.png",
    icon: BarChart3,
  },
  {
    key: "alerts",
    image: "/images/alert-1.png",
    icon: Bell,
  },
  {
    key: "profile",
    image: "/images/data-supplier.png",
    icon: Users,
  },
];

const AUTO_SLIDE_INTERVAL = 5000;

export function HowToUseSection() {
  const { t } = useI18n();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);

  const handleImageLoad = (key: string) => {
    setLoadedImages((prev) => new Set(prev).add(key));
  };

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % FEATURES.length);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + FEATURES.length) % FEATURES.length);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Auto-slide
  useEffect(() => {
    if (isPaused || !isVisible) return;
    const timer = setInterval(goToNext, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [isPaused, isVisible, goToNext]);

  if (!mounted) {
    return (
      <SSRPlaceholder
        height="700px"
        className="bg-gray-50 py-20 md:py-28"
      />
    );
  }

  const currentFeature = FEATURES[currentIndex];
  const Icon = currentFeature.icon;

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-gray-50 py-16 md:py-24"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <Container maxWidth="4xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`mb-12 text-center transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="text-brand-primary mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
            {t("home.howToUse.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-2xl text-lg">
            {t("home.howToUse.description")}
          </p>
        </div>

        {/* Feature Info - Above Screenshot */}
        <div
          className={`mb-8 flex flex-col items-center justify-between gap-4 transition-all duration-700 sm:flex-row ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="bg-brand-primary flex h-12 w-12 items-center justify-center rounded-xl">
              <Icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-brand-primary text-xl font-bold">
                {t(`home.howToUse.features.${currentFeature.key}.title`)}
              </h3>
              <p className="text-brand-primary/60 text-sm">
                {t(`home.howToUse.features.${currentFeature.key}.description`)}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
              aria-label="Previous"
            >
              <ChevronLeft className="text-brand-primary h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5">
              {FEATURES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-brand-primary w-6"
                      : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={goToNext}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
              aria-label="Next"
            >
              <ChevronRight className="text-brand-primary h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Browser Mockup with Screenshot */}
        <div
          className={`transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            {/* Browser Chrome */}
            <div className="flex h-10 items-center gap-2 border-b border-gray-100 bg-gray-50 px-4">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-4 flex-1">
                <div className="mx-auto max-w-md rounded-md bg-gray-200/60 px-4 py-1 text-center text-xs text-gray-500">
                  app.epidom.com
                </div>
              </div>
            </div>

            {/* Screenshot Container - Maintains aspect ratio */}
            <div className="relative bg-gray-100">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                {!loadedImages.has(currentFeature.key) && (
                  <Skeleton className="absolute inset-0 z-10" />
                )}
                <Image
                  src={currentFeature.image}
                  alt={t(`home.howToUse.features.${currentFeature.key}.title`)}
                  fill
                  className="object-contain object-top transition-opacity duration-500"
                  onLoad={() => handleImageLoad(currentFeature.key)}
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  priority={currentIndex === 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Slide Counter */}
        <div className="mt-6 text-center">
          <span className="text-brand-primary/40 text-sm">
            {currentIndex + 1} / {FEATURES.length}
          </span>
        </div>
      </Container>
    </section>
  );
}
