"use client";

/**
 * Social Proof Section - PREMIUM Edition
 *
 * Features:
 * - Infinite scrolling logo marquee
 * - Premium testimonial cards with hover effects
 * - Animated elements
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { ANIMATION_TIMING } from "@/lib/constants/animations";

const TESTIMONIALS = [
  { id: 1, rating: 5 },
  { id: 2, rating: 5 },
  { id: 3, rating: 5 },
];

export function SocialProofSection() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll testimonials
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % 3);
    }, ANIMATION_TIMING.CAROUSEL_INTERVAL);
    return () => clearInterval(timer);
  }, [isHovered]);

  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + 3) % 3);
  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % 3);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <section className="relative bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28 overflow-hidden">
        <div className="h-[500px]" />
      </section>
    );
  }

  return (
    <section className="relative bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28 overflow-hidden">
      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-brand-primary/50 text-sm font-semibold uppercase tracking-widest mb-4">
            {t("home.socialProof.trustedBy")}
          </p>
        </div>

        {/* Infinite Scroll Logo Marquee - using globals.css animation */}
        <div className="relative mb-20 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10" aria-hidden="true" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10" aria-hidden="true" />

          <div className="flex overflow-hidden">
            <div className="flex animate-marquee gap-12 py-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={`logo-1-${i}`}
                  className="flex-shrink-0 w-40 h-20 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                >
                  {i === 3 || i === 7 ? (
                    <div className="text-center px-4">
                      <span className="text-brand-primary/40 font-medium text-xs block">
                        {t("home.socialProof.yourBrand")}
                      </span>
                      <span className="text-[10px] text-brand-primary/30">
                        +
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-3xl" aria-hidden="true">🍪</span>
                      <span className="text-brand-primary/70 font-semibold text-sm">
                        Cookie Bar {(i % 4) + 1}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex animate-marquee gap-12 py-4" aria-hidden="true">
              {[...Array(8)].map((_, i) => (
                <div
                  key={`logo-2-${i}`}
                  className="flex-shrink-0 w-40 h-20 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                >
                  {i === 3 || i === 7 ? (
                    <div className="text-center px-4">
                      <span className="text-brand-primary/40 font-medium text-xs block">
                        {t("home.socialProof.yourBrand")}
                      </span>
                      <span className="text-[10px] text-brand-primary/30">
                        +
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-3xl">🍪</span>
                      <span className="text-brand-primary/70 font-semibold text-sm">
                        Cookie Bar {(i % 4) + 1}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instagram/Testimonials Section */}
        <div className="mt-8">
          <div className="text-center mb-12">
            <h3 className="text-brand-primary text-3xl md:text-4xl font-bold mb-4">
              {t("home.socialProof.instagramTitle")}
            </h3>
            <p className="text-brand-primary/60 text-lg">
              {t("home.socialProof.instagramSubtitle")}
            </p>
          </div>

          {/* Premium Testimonial Carousel */}
          <div
            className="relative max-w-4xl mx-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {TESTIMONIALS.map((item, index) => (
                  <div
                    key={item.id}
                    className="min-w-full"
                  >
                    <div className="relative bg-gradient-to-br from-brand-primary to-gray-700 p-8 md:p-12 lg:p-16 text-white">
                      {/* Decorative quote */}
                      <Quote className="absolute top-6 left-6 md:top-8 md:left-8 w-12 h-12 md:w-16 md:h-16 text-white/10" aria-hidden="true" />

                      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-white/20 to-white/5 border-2 border-white/30 flex items-center justify-center text-3xl md:text-4xl font-bold shadow-xl">
                            {t(`home.socialProof.author${index + 1}`).charAt(0)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 text-center md:text-left">
                          {/* Stars */}
                          <div className="flex justify-center md:justify-start gap-1 mb-4" aria-label={`${item.rating} out of 5 stars`}>
                            {[...Array(item.rating)].map((_, i) => (
                              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                            ))}
                          </div>

                          <p className="text-xl md:text-2xl lg:text-3xl font-light leading-relaxed mb-6">
                            &ldquo;{t(`home.socialProof.testimonial${index + 1}`)}&rdquo;
                          </p>

                          <div>
                            <p className="font-bold text-lg">
                              {t(`home.socialProof.author${index + 1}`)}
                            </p>
                            <p className="text-white/60 text-sm">
                              {t(`home.socialProof.role${index + 1}`)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Decorative elements */}
                      <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-6 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all duration-300 group"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6 text-brand-primary group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-6 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all duration-300 group"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6 text-brand-primary group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Progress indicators */}
            <div className="flex justify-center gap-3 mt-8" role="tablist" aria-label="Testimonial navigation">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative h-2 rounded-full transition-all duration-500 overflow-hidden ${
                    currentIndex === index
                      ? "bg-brand-primary w-12"
                      : "bg-gray-300 w-2 hover:bg-gray-400"
                  }`}
                  role="tab"
                  aria-selected={currentIndex === index}
                  aria-label={`Go to testimonial ${index + 1}`}
                >
                  {currentIndex === index && (
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-primary to-gray-600 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
