"use client";

/**
 * How to Use Section - PREMIUM Edition
 *
 * Features:
 * - Interactive feature cards with hover reveal
 * - Staggered entrance animations
 * - Premium glassmorphism effects
 * - Large featured image with overlay text
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Bell,
  BarChart3,
  Users,
  ArrowUpRight
} from "lucide-react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { getStaggerDelay } from "@/lib/constants/animations";

const FEATURES = [
  { key: "dashboard", image: "/images/dashboard.png", icon: LayoutDashboard, color: "from-blue-500 to-indigo-600" },
  { key: "management", image: "/images/management-reciptprod.png", icon: Package, color: "from-emerald-500 to-teal-600" },
  { key: "tracking", image: "/images/tracking.png", icon: TrendingUp, color: "from-amber-500 to-orange-600" },
  { key: "data", image: "/images/data-material.png", icon: BarChart3, color: "from-purple-500 to-violet-600" },
  { key: "alerts", image: "/images/alert-1.png", icon: Bell, color: "from-rose-500 to-pink-600" },
  { key: "profile", image: "/images/data-supplier.png", icon: Users, color: "from-cyan-500 to-blue-600" },
];

export function HowToUseSection() {
  const { t } = useI18n();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>();
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (key: string) => {
    setLoadedImages((prev) => new Set(prev).add(key));
  };

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <section className="relative bg-gray-50 py-20 md:py-28 overflow-hidden">
        <div className="h-[600px]" />
      </section>
    );
  }

  return (
    <section ref={ref} className="relative bg-gray-50 py-20 md:py-28 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-brand-primary text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            {t("home.howToUse.headline")}
          </h2>

          <p className="text-brand-primary/60 text-lg md:text-xl max-w-3xl mx-auto flex items-center justify-center gap-2 flex-wrap">
            {t("home.howToUse.description")}
            <span className="inline-block text-2xl animate-bounce" aria-label="French flag">🇫🇷</span>
          </p>
        </div>

        {/* Feature Grid - Bento Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ key, image, icon: Icon, color }, index) => (
            <article
              key={key}
              className={`group relative bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: getStaggerDelay(index),
              }}
            >
              {/* Screenshot */}
              <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                {!loadedImages.has(key) && (
                  <Skeleton className="absolute inset-0 z-10" />
                )}
                <Image
                  src={image}
                  alt={t(`home.howToUse.features.${key}.title`)}
                  fill
                  className="object-cover object-top transition-all duration-700 group-hover:scale-110"
                  onLoad={() => handleImageLoad(key)}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  loading="lazy"
                />

                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-t ${color} opacity-0 group-hover:opacity-80 transition-opacity duration-500`} aria-hidden="true" />

                {/* Icon and arrow on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <div className="flex items-center gap-3 text-white">
                    <Icon className="w-8 h-8" aria-hidden="true" />
                    <ArrowUpRight className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 relative">
                {/* Floating icon badge */}
                <div className={`absolute -top-6 left-6 w-12 h-12 rounded-xl bg-gradient-to-br ${color} shadow-lg flex items-center justify-center text-white transform group-hover:scale-110 transition-transform duration-300`} aria-hidden="true">
                  <Icon className="w-6 h-6" />
                </div>

                <div className="pt-4">
                  <h3 className="text-brand-primary text-xl font-bold mb-2 group-hover:text-brand-primary/80 transition-colors">
                    {t(`home.howToUse.features.${key}.title`)}
                  </h3>
                  <p className="text-brand-primary/60 text-sm leading-relaxed">
                    {t(`home.howToUse.features.${key}.description`)}
                  </p>
                </div>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-3xl ring-2 ring-inset ring-transparent group-hover:ring-brand-primary/20 transition-all duration-300 pointer-events-none" aria-hidden="true" />
            </article>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-gray-100">
            <span className="text-2xl" aria-hidden="true">✨</span>
            <p className="text-brand-primary/70 text-sm font-medium">
              {t("home.howToUse.aiGenerated")}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
