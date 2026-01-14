"use client";

/**
 * Data Row One Section
 *
 * Showcases data management features with mockup previews.
 * Layout: Feature highlight with surrounding data cards.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function DataRowOne() {
  const { t } = useI18n();

  return (
    <section className="bg-gray-50 py-16">
      <Container maxWidth="7xl">
        <div className="mx-auto mb-16 max-w-2xl text-center">
<<<<<<< HEAD
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
=======
          <h2 className="text-brand-primary mb-4 text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
>>>>>>> dev
            {t("services.data.title")}
          </h2>
          <p className="text-brand-primary/60 text-lg">{t("services.data.description1")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Main Feature - Large Card */}
          <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg lg:col-span-8">
            <div className="border-b border-gray-100 p-6">
              <h3 className="text-brand-primary text-lg font-bold">Centralized Data Management</h3>
            </div>
            <div className="relative aspect-video bg-gray-100">
              <Image
                src="/images/data-manage.png"
                alt="Data Management Interface"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

          {/* Side Features - Stacked Small Cards */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Small Card 1 */}
            <div className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
              <div className="border-b border-gray-100 p-4">
                {/* Title Aligned Left (No text-center) */}
                <h3 className="text-brand-primary text-lg font-bold">Smart Material Catalog</h3>
              </div>
              <div className="relative aspect-video w-full flex-1 bg-gray-100">
                <Image
                  src="/images/data-material.png"
                  alt="Material Data"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            {/* Small Card 2 */}
            <div className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
              <div className="border-b border-gray-100 p-4">
                {/* Title Aligned Left (No text-center) */}
                <h3 className="text-brand-primary text-lg font-bold">Recipe Costing</h3>
              </div>
              <div className="relative aspect-video w-full flex-1 bg-gray-100">
                <Image
                  src="/images/data-recipe.png"
                  alt="Recipe Data"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
