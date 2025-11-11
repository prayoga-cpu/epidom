"use client";

/**
 * Data Row One Section
 *
 * Showcases data management features with mockup previews.
 * Layout: large mockups 60% (left), description + small mockups 40% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function DataRowOne() {
  return (
    <ServicesSection
      variant="image-left-text-right"
      textContent={{
        titleKey: "services.data.title",
        descriptionKey: "services.data.description1",
        description2Key: "services.data.description2",
      }}
      leftImages={[
        {
          src: "/images/data-manage.png",
          alt: "Data management interface 1",
          quality: 85,
        },
        {
          src: "/images/data-material.png",
          alt: "Data management interface 2",
          quality: 85,
        },
      ]}
      rightImages={[
        {
          src: "/images/data-product.png",
          alt: "Data management small interface 1",
          quality: 80,
        },
        {
          src: "/images/data-recipe.png",
          alt: "Data management small interface 2",
          quality: 80,
        },
      ]}
      gridCols={10}
      leftSpan={6}
      rightSpan={4}
      mobileOrder="right-first"
    />
  );
}
