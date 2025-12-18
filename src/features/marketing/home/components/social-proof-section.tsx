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
import { SSRPlaceholder } from "@/components/shared";

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
      setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, ANIMATION_TIMING.CAROUSEL_INTERVAL);
    return () => clearInterval(timer);
  }, [isHovered]);

  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <SSRPlaceholder
        height="500px"
        className="bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28"
      />
    );
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28">
      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <p className="text-brand-primary/50 mb-4 text-sm font-semibold tracking-widest uppercase">
            {t("home.socialProof.trustedBy")}
          </p>
        </div>

        {/* Infinite Scroll Logo Marquee - using globals.css animation */}
        {/* Static Logo Grid - Simplified */}
        <div className="mb-20">
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {[...Array(4)].map((_, i) => (
              <div
                key={`logo-${i}`}
                className="group flex h-20 w-40 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2 opacity-60 transition-opacity group-hover:opacity-100">
                  <span className="text-3xl" aria-hidden="true">
                    🍪
                  </span>
                  <span className="text-brand-primary/70 text-sm font-semibold">
                    Cookie Bar {i + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instagram/Testimonials Section */}
        <div className="mt-8">
          <div className="mb-12 text-center">
            <h3 className="text-brand-primary mb-4 text-3xl font-bold md:text-4xl">
              {t("home.socialProof.instagramTitle")}
            </h3>
            <p className="text-brand-primary/60 text-lg">
              {t("home.socialProof.instagramSubtitle")}
            </p>
          </div>

          {/* Premium Testimonial Carousel */}
          <div
            className="relative mx-auto max-w-4xl"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {TESTIMONIALS.map((item, index) => (
                  <div key={item.id} className="min-w-full">
                    <div className="from-brand-primary relative bg-gradient-to-br to-gray-700 p-8 text-white md:p-12 lg:p-16">
                      {/* Decorative quote */}
                      <Quote
                        className="absolute top-6 left-6 h-12 w-12 text-white/10 md:top-8 md:left-8 md:h-16 md:w-16"
                        aria-hidden="true"
                      />

                      <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-white/20 to-white/5 text-3xl font-bold shadow-xl md:h-24 md:w-24 md:text-4xl">
                            {t(`home.socialProof.author${index + 1}`).charAt(0)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 text-center md:text-left">
                          {/* Stars */}
                          <div
                            className="mb-4 flex justify-center gap-1 md:justify-start"
                            aria-label={`${item.rating} out of 5 stars`}
                          >
                            {[...Array(item.rating)].map((_, i) => (
                              <Star
                                key={i}
                                className="fill-brand-primary/20 text-brand-primary h-5 w-5"
                                aria-hidden="true"
                              />
                            ))}
                          </div>

                          <p className="mb-6 text-xl leading-relaxed font-light md:text-2xl lg:text-3xl">
                            &ldquo;{t(`home.socialProof.testimonial${index + 1}`)}&rdquo;
                          </p>

                          <div>
                            <p className="text-lg font-bold">
                              {t(`home.socialProof.author${index + 1}`)}
                            </p>
                            <p className="text-sm text-white/60">
                              {t(`home.socialProof.role${index + 1}`)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Decorative elements */}
                      <div
                        className="absolute right-0 bottom-0 h-40 w-40 rounded-full bg-white/5 blur-3xl"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="group absolute top-1/2 left-0 flex h-12 w-12 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-gray-50 lg:-translate-x-6"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="text-brand-primary h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <button
              onClick={nextSlide}
              className="group absolute top-1/2 right-0 flex h-12 w-12 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-gray-50 lg:translate-x-6"
              aria-label="Next testimonial"
            >
              <ChevronRight className="text-brand-primary h-6 w-6 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Progress indicators */}
            <div
              className="mt-8 flex justify-center gap-3"
              role="tablist"
              aria-label="Testimonial navigation"
            >
              {TESTIMONIALS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative h-2 overflow-hidden rounded-full transition-all duration-500 ${
                    currentIndex === index
                      ? "bg-brand-primary w-12"
                      : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                  role="tab"
                  aria-selected={currentIndex === index}
                  aria-label={`Go to testimonial ${index + 1}`}
                >
                  {currentIndex === index && (
                    <div className="from-brand-primary absolute inset-0 animate-pulse bg-gradient-to-r to-gray-600" />
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
