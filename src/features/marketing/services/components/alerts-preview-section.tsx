"use client";

/**
 * Alerts Preview Section
 *
 * Showcases alert notifications and monitoring features.
 * Layout: description + small preview 40% (left), large preview 60% (right).
 *
 * @component
 */

import { ServicesSection } from "./services-section";

export function AlertsPreviewSection() {
  return (
    <ServicesSection
      variant="text-left-image-right"
      textContent={{
        titleKey: "services.alerts.title",
        descriptionKey: "services.alerts.description",
      }}
      leftImages={[
        {
          src: "/images/alert-1.png",
          alt: "Alerts interface small preview",
          quality: 85,
        },
      ]}
      rightImages={[
        {
          src: "/images/alert-2.png",
          alt: "Alerts interface large preview",
          priority: true,
          quality: 90,
        },
      ]}
      gridCols={10}
      leftSpan={4}
      rightSpan={6}
      sectionClassName="flex items-center"
    />
  );
}
