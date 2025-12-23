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
    <section className="relative z-10 flex items-center overflow-hidden bg-gray-900 py-16 text-white md:py-24">
      {/* Abstract Background Grid */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(#4b5563 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      ></div>

      <div className="absolute top-0 right-0 left-0 z-10 h-32 bg-gradient-to-b from-gray-900 to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />

      <div className="services-narrow-container relative z-20">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-xs font-medium tracking-wider text-green-400 uppercase">
              Live Tracking System
            </span>
          </div>

          <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {t("services.tracking.title")}
          </h2>

          {t("services.tracking.description") && (
            <p className="text-lg leading-relaxed text-gray-300 md:text-xl">
              {t("services.tracking.description")}
            </p>
          )}
        </div>

        {/* Large Mockup - Browser Window Style */}
        <div className="relative mx-auto max-w-5xl">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-1 shadow-2xl backdrop-blur md:p-2">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
              <Image
                src="/images/tracking.png"
                alt="Active stock tracking interface"
                fill
                className="object-cover"
                priority={true}
                quality={90}
              />

              {/* Overlay gradient for depth */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-900/50 to-transparent" />
            </div>
          </div>

          {/* Floating badges */}
          <div className="animate-bounce-slow absolute top-12 -right-4 hidden lg:block">
            <div className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-semibold text-gray-900 shadow-xl">
              <div className="rounded-md bg-blue-100 p-1.5 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              Real-time Updates
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
