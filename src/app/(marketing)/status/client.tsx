"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function StatusClient() {
  return (
    <PlaceholderPage
      eyebrow="System Status"
      title="All systems operational."
      body="Real-time status for every Epidom service. Planned maintenance windows are announced here at least 48 hours in advance."
    >
      <PlaceholderSection
        title="Services"
        items={[
          "API & Core Platform — operational",
          "Storefront & QR Menu — operational",
          "Payment Processing (Stripe / SumUp) — operational",
          "WhatsApp Notifications — operational",
          "Analytics & Reporting — operational",
        ]}
      />
      <PlaceholderSection
        title="Incident history"
        items={[
          "No incidents in the last 90 days",
          "Uptime SLA: 99.9% — full history published monthly",
        ]}
      />
    </PlaceholderPage>
  );
}
