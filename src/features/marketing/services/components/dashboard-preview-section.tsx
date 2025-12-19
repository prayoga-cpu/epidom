

"use client";

/**
 * Dashboard Preview Section
 *
 * Displays dashboard mockup with premium glassmorphism effects.
 * Layout: Split view with floating dashboard mockups.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function DashboardPreviewSection() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden py-12 md:py-24 lg:py-32">
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-brand-primary/5 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-y-1/2 -translate-x-1/2 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <Container maxWidth="7xl" className="relative z-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left: Image Showcase */}
          <div className="lg:col-span-7 lg:order-1">
            <div className="relative mx-auto w-full max-w-[600px] perspective-1000 lg:mx-0">
              <div
                className="relative z-20 overflow-hidden rounded-xl border border-gray-200/50 bg-white/50 shadow-2xl backdrop-blur-sm transition-transform duration-500 hover:scale-[1.02]"
                style={{ transform: "rotateY(5deg) rotateX(2deg)" }}
              >
                <div className="aspect-video w-full relative">
                  <Image
                    src="/images/dashboard.png"
                    alt="Dashboard interface preview"
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 40vw"
                  />
                  {/* Glass overlay shine */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Decorative background blob */}
              <div className="absolute -inset-4 z-10 rounded-xl bg-gradient-to-tr from-brand-primary/20 to-blue-500/20 blur-xl opacity-60 transform rotate-[-2deg]" />
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="space-y-6 lg:col-span-5 lg:order-2">
            <div className="inline-flex items-center rounded-full border border-brand-primary/10 bg-brand-primary/5 px-3 py-1 text-sm font-medium text-brand-primary backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-brand-primary mr-2"></span>
              Full Overview
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-brand-primary sm:text-4xl lg:text-5xl">
              {t("services.dashboard.subtitle")}
            </h2>

            <p className="text-lg leading-relaxed text-brand-primary/80">
              {t("services.dashboard.description")}
            </p>

            <div className="pt-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                    { label: "Low Stock Items", value: "3", status: "Action Needed", color: "text-red-600 bg-red-50" },
                    { label: "Active Orders", value: "12", status: "On Track", color: "text-blue-600 bg-blue-50" }
                 ].map((stat, i) => (
                   <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                     <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                     <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.color}`}>{stat.status}</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
