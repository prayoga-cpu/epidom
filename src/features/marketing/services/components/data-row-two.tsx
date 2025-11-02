"use client";

import Image from "next/image";

export function DataRowTwo() {
  return (
    <section className="relative z-10 overflow-visible bg-white py-8 md:py-4 lg:py-16">
      <div className="services-narrow-container">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column (25%) - 2 Small Mockups */}
          <div className="space-y-3 lg:col-span-3">
            {/* Small Mockup 1 */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/data-supplier.png"
                alt="Supplier data interface"
                fill
                className="object-cover scale-[1.01]"
                quality={80}
              />
            </div>

            {/* Small Mockup 2 */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/data-material.png"
                alt="Material data interface"
                fill
                className="object-cover scale-[1.01]"
                quality={80}
              />
            </div>
          </div>

          {/* Right Column (75%) - 1 Large Mockup */}
          <div className="lg:col-span-9">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src="/images/data-manage.png"
                alt="Data management overview interface"
                fill
                className="object-cover scale-[1.01]"
                priority={true}
                quality={90}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
