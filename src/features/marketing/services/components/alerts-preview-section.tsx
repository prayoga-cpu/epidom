"use client";

/**
 * Alerts Preview Section
 *
 * Showcases alert notifications and monitoring features.
 * Focuses on mobile responsiveness and notifications.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function AlertsPreviewSection() {
  const { t } = useI18n();

  return (
    <section className="py-16 md:py-24 bg-white">
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
                <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-6">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>

                <h2 className="text-3xl font-extrabold tracking-tight text-brand-primary sm:text-4xl">
                   {t("services.alerts.title")}
                </h2>

                <p className="text-lg leading-relaxed text-brand-primary/80">
                   {t("services.alerts.description")}
                </p>

                <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-gray-700">Low Stock Alerts</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-sm font-medium text-gray-700">Expiry Notifications</span>
                    </div>
                </div>
            </div>

            {/* Right Visual - Adaptive Card */}
            <div className="relative flex justify-center lg:justify-end">
                {/* Main Image Container - Adaptive Aspect Ratio */}
                <div className="relative z-10 w-full max-w-md">
                   <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-2xl">
                       <div className="aspect-video relative bg-gray-50">
                          <Image
                             src="/images/alert-2.png"
                             alt="Alerts Interface"
                             fill
                             className="object-cover"
                             priority
                          />
                       </div>
                   </div>
                </div>

                {/* Floating Notification - Decorative */}
                <div className="absolute -bottom-6 left-0 z-20 w-64 animate-bounce-slow">
                    <div className="bg-white/95 backdrop-blur rounded-xl border border-gray-100 p-4 shadow-xl">
                        <div className="flex gap-3">
                             <div className="h-10 w-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                !
                             </div>
                             <div>
                                 <p className="text-xs font-bold text-gray-900">Low Stock Warning</p>
                                 <p className="text-[10px] text-gray-500 mt-1">Chocolate Chips is 2kg below safety stock.</p>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </Container>
    </section>
  );
}
