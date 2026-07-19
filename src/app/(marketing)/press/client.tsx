"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function PressClient() {
  return (
    <PlaceholderPage
      eyebrow="Press"
      title="Media kit & press contacts."
      body="Covering Epidom? We'd love to help. Find brand assets, fact sheets, and direct contact details for the communications team below."
    >
      <PlaceholderSection
        title="About Epidom"
        items={[
          "Founded: 2024 — Jakarta, Indonesia",
          "Focus: all-in-one operations platform for independent F&B businesses",
          "Markets: Indonesia, France, and South-East Asia",
          "Backed by PRIONATION",
        ]}
      />
      <PlaceholderSection
        title="Media assets"
        items={[
          "Logo pack (SVG, PNG, dark & light) — available on request",
          "Product screenshots — available on request",
          "Founder headshots — available on request",
        ]}
      />
      <PlaceholderSection
        title="Press contact"
        items={[
          "cro@prionation.io, ceo@prionation.io, consult@prionation.io — response within 24 hours on business days",
        ]}
      />
    </PlaceholderPage>
  );
}
