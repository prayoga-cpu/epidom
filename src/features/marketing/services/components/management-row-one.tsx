"use client";

/**
 * Management Row One Section
 *
 * Displays management features with lazy-loaded images on intersection.
 * Uses Intersection Observer for performance optimization.
 * Layout: text + small mockup 40% (left), large mockup 60% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function ManagementRowOne() {
  return (
    <ServicesSection
      variant="text-left-image-right"
      textContent={{
        titleKey: "services.management.title",
        subtitleKey: "services.management.subtitle",
        descriptionKey: "services.management.description",
      }}
      leftImages={[
        {
          src: "/images/management-history.png",
          alt: "Production history interface",
          quality: 80,
          sizes: "(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 30vw",
          loading: "lazy",
        },
      ]}
      rightImages={[
        {
          src: "/images/management-editstock.png",
          alt: "Edit stock interface",
          quality: 85,
          sizes: "(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 45vw",
          loading: "lazy",
        },
      ]}
      gridCols={10}
      leftSpan={4}
      rightSpan={6}
      useIntersectionObserver={true}
      sectionClassName="flex items-center"
    />
  );
}
