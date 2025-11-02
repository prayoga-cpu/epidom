"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";

export function DashboardPreviewSection() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 flex items-center overflow-visible bg-white py-8 md:py-4 lg:py-16">
      <div className="services-narrow-container">
        <div className="grid grid-cols-1 items-center gap-4 md:gap-6 lg:grid-cols-10 lg:gap-8">
          {/* Left Column - Dashboard Image (70%) */}
          <div className="order-2 lg:order-1 lg:col-span-7">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/dashboard.png"
                alt="Dashboard interface preview"
                fill
                className="object-cover scale-[1.01]"
                priority={true}
                quality={85}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 70vw, 50vw"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
              />
            </div>
          </div>

          {/* Right Column - Text Content (30%) */}
          <div className="order-1 lg:order-2 lg:col-span-3">
            <div className="space-y-3 text-left md:space-y-5">
              {/* Subtitle */}
              <h2 className="text-subtitle" style={{ color: "var(--color-brand-primary)" }}>
                {t("services.dashboard.subtitle")}
              </h2>

              {/* Description */}
              <p className="text-description" style={{ color: "#444444" }}>
                {t("services.dashboard.description")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
