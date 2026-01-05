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
    <section className="bg-white py-16 md:py-24">
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>

            <h2 className="text-brand-primary text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              {t("services.alerts.title")}
            </h2>

            <p className="text-brand-primary/60 text-lg leading-relaxed">
              {t("services.alerts.description")}
            </p>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 shadow-sm">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-brand-primary text-sm font-medium">Low Stock Alerts</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 shadow-sm">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-brand-primary text-sm font-medium">Expiry Notifications</span>
              </div>
            </div>
          </div>

          {/* Right Visual - Adaptive Card */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Main Image Container - Adaptive Aspect Ratio */}
            <div className="relative z-10 w-full max-w-md">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
                <div className="relative aspect-video bg-gray-50">
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
            <div className="animate-bounce-slow absolute -bottom-6 left-0 z-20 w-64">
              <div className="rounded-xl border border-gray-100 bg-white/95 p-4 shadow-xl backdrop-blur">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    !
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Low Stock Warning</p>
                    <p className="mt-1 text-[10px] text-gray-500">
                      Chocolate Chips is 2kg below safety stock.
                    </p>
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
