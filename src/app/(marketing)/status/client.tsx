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
      body="Current status of Epidom's core services, updated manually by the team. No active incidents to report."
    >
      <PlaceholderSection
        title="Services"
        items={[
          "API & Core Platform — operational",
          "Storefront & QR Menu — operational",
          "Payment Processing (Stripe / Xendit) — operational",
          "WhatsApp Notifications — operational",
        ]}
      />
      <PlaceholderSection
        title="Report an issue"
        items={["See the Contact page — we respond within 24 hours on business days"]}
      />
    </PlaceholderPage>
  );
}
