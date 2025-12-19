"use client";

/**
 * Data Row Two Section
 *
 * Showcases supplier and material data management.
 * Layout: Horizontal scrolling highlight.
 *
 * @component
 */

import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function DataRowTwo() {
  return (
    <section className="py-16 md:py-24 bg-white overflow-hidden">
      <Container maxWidth="7xl">
         <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="w-full md:w-1/3 space-y-4">
                 <h3 className="text-2xl font-bold text-brand-primary">Supplier Intelligence</h3>
                 <p className="text-gray-600 leading-relaxed">
                   Manage your suppliers, track price history, and automate purchasing orders in one place.
                 </p>
                 < div className="h-1 w-20 bg-brand-primary rounded-full mt-4" />
            </div>

            <div className="w-full md:w-2/3">
               <div className="relative group perspective-1000">
                  <div className="absolute inset-x-8 top-4 bottom-4 bg-brand-primary/5 rounded-2xl transform rotate-3 transition-transform group-hover:rotate-6 duration-500" />
                  <div className="absolute inset-x-4 top-2 bottom-2 bg-brand-primary/10 rounded-2xl transform -rotate-2 transition-transform group-hover:-rotate-4 duration-500" />

                  <div className="relative rounded-xl overflow-hidden shadow-xl border border-gray-100 bg-white aspect-video">
                     <Image
                       src="/images/data-supplier.png"
                       alt="Supplier Data"
                       fill
                       className="object-cover hover:scale-105 transition-transform duration-700"
                     />
                     <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/10" />
                  </div>
               </div>
            </div>
         </div>
      </Container>
    </section>
  );
}
