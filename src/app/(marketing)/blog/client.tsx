"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function BlogClient() {
  return (
    <PlaceholderPage
      eyebrow="Blog"
      title="Insights for F&B operators."
      body="Practical guides, industry trends, and product deep-dives written by the Epidom team and operators in the field."
    >
      <PlaceholderSection
        title="Coming soon"
        items={[
          "How to cut food waste by 30% with real-time inventory",
          "QR menus vs printed menus: a cost breakdown for small cafés",
          "5 reporting metrics every warungs owner should track",
          "Going cashless in Indonesia: a field guide",
        ]}
      />
    </PlaceholderPage>
  );
}
