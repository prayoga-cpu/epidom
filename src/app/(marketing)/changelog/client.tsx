"use client";
import { PlaceholderPage, PlaceholderSection } from "@/features/marketing/shared/components/placeholder-page";
export function ChangelogClient() {
  return (
    <PlaceholderPage
      eyebrow="Changelog"
      title="What's new in Epidom."
      body="Every improvement, fix, and new feature — logged here. We ship fast and document everything so you always know what changed and why."
    >
      <PlaceholderSection
        title="Coming soon"
        items={[
          "Multi-outlet dashboard with consolidated analytics",
          "WhatsApp order notifications (two-way)",
          "Staff shift scheduling and payroll export",
          "Offline POS mode with background sync",
        ]}
      />
      <PlaceholderSection
        title="Recent releases"
        items={[
          "v1.2 — QR-code digital menu with live stock sync",
          "v1.1 — Integrated payments via SumUp and Stripe",
          "v1.0 — Public launch: inventory, storefront, and reporting",
        ]}
      />
    </PlaceholderPage>
  );
}
