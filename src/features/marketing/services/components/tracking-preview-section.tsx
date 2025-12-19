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
    <section className="relative z-10 flex items-center overflow-hidden bg-gray-900 py-16 md:py-24 text-white">
      {/* Abstract Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20"
           style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      </div>

      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-900 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-900 to-transparent z-10" />

      <div className="services-narrow-container relative z-20">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
           <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Live Tracking System</span>
           </div>

           <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl mb-6">
             {t("services.tracking.title")}
           </h2>

           {t("services.tracking.description") && (
             <p className="text-lg text-gray-400 leading-relaxed md:text-xl">
               {t("services.tracking.description")}
             </p>
           )}
        </div>

        {/* Large Mockup - Browser Window Style */}
        <div className="relative mx-auto max-w-5xl">
           <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700 p-1 md:p-2 shadow-2xl">
              <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 relative aspect-video">
                  <Image
                    src="/images/tracking.png"
                    alt="Active stock tracking interface"
                    fill
                    className="object-cover"
                    priority={true}
                    quality={90}
                  />

                  {/* Overlay gradient for depth */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-900/50 to-transparent pointer-events-none" />
              </div>
           </div>

           {/* Floating badges */}
           <div className="absolute -right-4 top-12 hidden lg:block animate-bounce-slow">
              <div className="bg-white text-gray-900 p-3 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-2">
                 <div className="bg-blue-100 text-blue-600 p-1.5 rounded-md">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                 </div>
                 Real-time Updates
              </div>
           </div>
        </div>
      </div>
    </section>
  );
}
