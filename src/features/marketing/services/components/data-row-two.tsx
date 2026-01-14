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
    <section className="overflow-hidden bg-white py-16 md:py-24">
      <Container maxWidth="7xl">
        <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
          <div className="w-full space-y-4 md:w-1/3">
<<<<<<< HEAD
            <h2 className="text-brand-primary text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
=======
            <h2 className="text-brand-primary text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
>>>>>>> dev
              Supplier Intelligence
            </h2>
            <p className="text-brand-primary/60 text-lg leading-relaxed">
              Manage your suppliers, track price history, and automate purchasing orders in one
              place.
            </p>
            <div className="bg-brand-primary mt-4 h-1 w-20 rounded-full" />
          </div>

          <div className="w-full md:w-2/3">
            <div className="group perspective-1000 relative">
              <div className="bg-brand-primary/5 absolute inset-x-8 top-4 bottom-4 rotate-3 transform rounded-2xl transition-transform duration-500 group-hover:rotate-6" />
              <div className="bg-brand-primary/10 absolute inset-x-4 top-2 bottom-2 -rotate-2 transform rounded-2xl transition-transform duration-500 group-hover:-rotate-4" />

              <div className="relative aspect-video overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
                <Image
                  src="/images/data-supplier.png"
                  alt="Supplier Data"
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105"
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
