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
        <div className="bg-brand-primary/5 absolute top-0 right-0 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <Container maxWidth="7xl" className="relative z-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left: Image Showcase */}
          <div className="lg:order-1 lg:col-span-7">
            <div className="perspective-1000 relative mx-auto w-full max-w-[600px] lg:mx-0">
              <div
                className="relative z-20 overflow-hidden rounded-xl border border-gray-200/50 bg-white/50 shadow-2xl backdrop-blur-sm transition-transform duration-500 hover:scale-[1.02]"
                style={{ transform: "rotateY(5deg) rotateX(2deg)" }}
              >
                <div className="relative aspect-video w-full">
                  <Image
                    src="/images/dashboard.png"
                    alt="Dashboard interface preview"
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 40vw"
                  />
                  {/* Glass overlay shine */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />
                </div>
              </div>

              {/* Decorative background blob */}
              <div className="from-brand-primary/20 absolute -inset-4 z-10 rotate-[-2deg] transform rounded-xl bg-gradient-to-tr to-blue-500/20 opacity-60 blur-xl" />
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="space-y-6 lg:order-2 lg:col-span-5">
            <div className="border-brand-primary/10 bg-brand-primary/5 text-brand-primary inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium backdrop-blur-md">
              <span className="bg-brand-primary mr-2 flex h-2 w-2 rounded-full"></span>
              Full Overview
            </div>

<<<<<<< HEAD
            <h2 className="text-brand-primary text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
=======
            <h2 className="text-brand-primary text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
>>>>>>> dev
              {t("services.dashboard.subtitle")}
            </h2>

            <p className="text-brand-primary/60 text-lg leading-relaxed">
              {t("services.dashboard.description")}
            </p>

            <div className="pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  {
                    label: "Low Stock Items",
                    value: "3",
                    status: "Action Needed",
                    color: "text-red-600 bg-red-50",
                  },
                  {
                    label: "Active Orders",
                    value: "12",
                    status: "On Track",
                    color: "text-blue-600 bg-blue-50",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <p className="mb-1 text-sm font-medium text-gray-500">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${stat.color}`}
                      >
                        {stat.status}
                      </span>
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
