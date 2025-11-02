/**
 * Services Page
 *
 * Showcases all EPIDOM features and functionality.
 * Displays preview sections with animated mockups and descriptions.
 * Sections: Hero, Dashboard, Management, Tracking, Data, Alerts
 *
 * @page
 */

import { HeroSection } from "@/features/marketing/services/components/hero-section";
import { DashboardPreviewSection } from "@/features/marketing/services/components/dashboard-preview-section";
import { ManagementRowOne } from "@/features/marketing/services/components/management-row-one";
import { ManagementRowTwo } from "@/features/marketing/services/components/management-row-two";
import { TrackingPreviewSection } from "@/features/marketing/services/components/tracking-preview-section";
import { DataRowOne } from "@/features/marketing/services/components/data-row-one";
import { DataRowTwo } from "@/features/marketing/services/components/data-row-two";
import { AlertsPreviewSection } from "@/features/marketing/services/components/alerts-preview-section";

export default function ServicesPage() {
  return (
    <main
      className="min-h-screen bg-white pt-24 md:pt-32"
      style={{ color: "var(--color-brand-primary)" }}
    >
      <div className="animate-slide-up mb-8 md:mb-12">
        <HeroSection />
      </div>
      <div className="animate-slide-up-delayed mb-8 md:mb-12">
        <DashboardPreviewSection />
      </div>
      <div className="animate-slide-up-delayed-2 mb-8 md:mb-12">
        <ManagementRowOne />
        <ManagementRowTwo />
      </div>
      <div className="animate-slide-up-delayed-3 mb-8 md:mb-12">
        <TrackingPreviewSection />
      </div>
      <div className="mb-8 md:mb-12">
        <DataRowOne />
      </div>
      <div className="mb-8 md:mb-12">
        <DataRowTwo />
      </div>
      <div className="animate-slide-up-delayed-3">
        <AlertsPreviewSection />
      </div>
    </main>
  );
}
