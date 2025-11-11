"use client";

/**
 * Management Row Two Section
 *
 * Displays production history and delivery management mockups.
 * Layout: large mockup 75% (left), two small mockups 25% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function ManagementRowTwo() {
  return (
    <ServicesSection
      variant="images-only"
      leftImages={[
        {
          src: "/images/management-history.png",
          alt: "Production history interface",
          priority: true,
          quality: 90,
        },
      ]}
      rightImages={[
        {
          src: "/images/management-delivery.png",
          alt: "Delivery management interface",
          quality: 85,
        },
        {
          src: "/images/management-reciptprod.png",
          alt: "Recipe production interface",
          quality: 85,
        },
      ]}
      gridCols={12}
      leftSpan={9}
      rightSpan={3}
      mobileOrder="right-first"
      sectionClassName="flex items-center"
    />
  );
}
