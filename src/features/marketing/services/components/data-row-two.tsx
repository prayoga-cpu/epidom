"use client";

/**
 * Data Row Two Section
 *
 * Showcases supplier and material data management.
 * Layout: two small mockups 25% (left), large overview mockup 75% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function DataRowTwo() {
  return (
    <ServicesSection
      variant="images-only"
      leftImages={[
        {
          src: "/images/data-supplier.png",
          alt: "Supplier data interface",
          quality: 80,
        },
        {
          src: "/images/data-material.png",
          alt: "Material data interface",
          quality: 80,
        },
      ]}
      rightImages={[
        {
          src: "/images/data-manage.png",
          alt: "Data management overview interface",
          priority: true,
          quality: 90,
        },
      ]}
      gridCols={12}
      leftSpan={3}
      rightSpan={9}
    />
  );
}
