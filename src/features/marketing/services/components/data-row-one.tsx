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
    <section className="py-16 bg-gray-50">
      <Container maxWidth="7xl">
         <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-primary sm:text-4xl mb-4">
              {t("services.data.title")}
            </h2>
            <p className="text-lg text-brand-primary/80">
              {t("services.data.description1")}
            </p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8">
             {/* Main Feature - Large */}
             <div className="lg:col-span-8 rounded-2xl overflow-hidden bg-white shadow-lg border border-gray-100 group">
                 <div className="p-6 border-b border-gray-100">
                     <h3 className="font-bold text-lg text-brand-primary">Centralized Data Management</h3>
                 </div>
                 <div className="aspect-video relative bg-gray-100">
                    <Image
                       src="/images/data-manage.png"
                       alt="Data Management Interface"
                       fill
                       className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                 </div>
             </div>

             {/* Side Features - Stacked */}
             <div className="lg:col-span-4 flex flex-col gap-6">
                 <div className="flex-1 rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100 group p-4 flex flex-col">
                     <div className="aspect-video w-full relative rounded-lg overflow-hidden bg-gray-100 mb-4 flex-1">
                        <Image
                           src="/images/data-material.png"
                           alt="Material Data"
                           fill
                           className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                     </div>
                     <span className="font-medium text-brand-primary text-center">Smart Material Catalog</span>
                 </div>

                 <div className="flex-1 rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100 group p-4 flex flex-col">
                     <div className="aspect-video w-full relative rounded-lg overflow-hidden bg-gray-100 mb-4 flex-1">
                        <Image
                           src="/images/data-recipe.png"
                           alt="Recipe Data"
                           fill
                           className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                     </div>
                     <span className="font-medium text-brand-primary text-center">Recipe Costing</span>
                 </div>
             </div>
         </div>
      </Container>
    </section>
  );
}
