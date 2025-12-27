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
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="relative aspect-video border-b border-gray-100 bg-gray-50">
              <Image
                src="/images/management-delivery.png"
                alt="Delivery Management"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <h3 className="text-brand-primary mb-2 text-xl font-bold">Delivery Tracking</h3>
              <p className="text-brand-primary/60 text-sm">Monitor delivery status in real-time.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="relative aspect-video border-b border-gray-100 bg-gray-50">
              <Image
                src="/images/management-history.png"
                alt="Production History"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <h3 className="text-brand-primary mb-2 text-xl font-bold">Production History</h3>
              <p className="text-brand-primary/60 text-sm">
                Track and analyze past production runs.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="relative aspect-video border-b border-gray-100 bg-gray-50">
              <Image
                src="/images/management-reciptprod.png"
                alt="Recipe Production"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <h3 className="text-brand-primary mb-2 text-xl font-bold">Recipe Costing</h3>
              <p className="text-brand-primary/60 text-sm">
                Manage interactive recipes costs easily.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
