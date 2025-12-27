"use client";

/**
 * Management Row Two Section
 *
 * Displays additional management interfaces in a cohesive gallery layout.
 * Gallery layout showcasing production history and delivery management.
 *
 * @component
 */

import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function ManagementRowTwo() {
  return (
    <section className="py-12 lg:py-24">
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {/* Card 1 */}
           <div className="group rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="aspect-video relative bg-gray-50 border-b border-gray-100">
                 <Image
                    src="/images/management-delivery.png"
                    alt="Delivery Management"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                 />
              </div>
              <div className="p-5">
                <h3 className="font-bold text-brand-primary mb-2">Delivery Tracking</h3>
                <p className="text-sm text-gray-500">Monitor delivery status in real-time.</p>
              </div>
           </div>

           {/* Card 2 */}
           <div className="group rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 lg:-mt-12">
              <div className="aspect-video relative bg-gray-50 border-b border-gray-100">
                 <Image
                    src="/images/management-history.png"
                    alt="Production History"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                 />
              </div>
              <div className="p-5">
                <h3 className="font-bold text-brand-primary mb-2">Production History</h3>
                <p className="text-sm text-gray-500">Track and analyze past production runs.</p>
              </div>
           </div>

           {/* Card 3 */}
           <div className="group rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="aspect-video relative bg-gray-50 border-b border-gray-100">
                 <Image
                    src="/images/management-reciptprod.png"
                    alt="Recipe Production"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                 />
              </div>
              <div className="p-5">
                <h3 className="font-bold text-brand-primary mb-2">Recipe Costing</h3>
                <p className="text-sm text-gray-500">Manage interactive recipes costs easily.</p>
              </div>
           </div>
        </div>
      </Container>
    </section>
  );
}
