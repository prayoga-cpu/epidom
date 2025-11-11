"use client";

/**
 * Dashboard Preview Section
 *
 * Displays dashboard mockup with priority loading and blur placeholder.
 * Layout: image 70% (left), description 30% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function DashboardPreviewSection() {
  return (
    <ServicesSection
      variant="image-left-text-right"
      textContent={{
        subtitleKey: "services.dashboard.subtitle",
        descriptionKey: "services.dashboard.description",
      }}
      leftImages={[
        {
          src: "/images/dashboard.png",
          alt: "Dashboard interface preview",
          priority: true,
          quality: 85,
          sizes: "(max-width: 768px) 100vw, (max-width: 1024px) 70vw, 50vw",
          placeholder: "blur",
          blurDataURL:
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
        },
      ]}
      rightImages={[]}
      gridCols={10}
      leftSpan={7}
      rightSpan={3}
      mobileOrder="right-first"
      sectionClassName="flex items-center"
    />
  );
}
