"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function PartnersClient() {
  return (
    <PlaceholderPage
      eyebrow="Partners"
      title="Grow together with Epidom."
      body="We partner with payment providers, hardware vendors, accountants, and resellers who share our mission of simplifying F&B operations."
    >
      <PlaceholderSection
        title="Partnership types"
        items={[
          "Integration partners — connect your product to the Epidom platform via API",
          "Reseller partners — offer Epidom to your existing F&B client base",
          "White-label — deploy a branded version of Epidom for your market",
          "Referral programme — earn recurring commission for every customer you refer",
        ]}
      />
      <PlaceholderSection
        title="Current integrations"
        items={[
          "Stripe — card payments and invoicing",
          "SumUp — in-person card terminals",
          "WhatsApp Business API — order and stock notifications",
        ]}
      />
      <PlaceholderSection
        title="Become a partner"
        items={[
          "Email cro@prionation.io, ceo@prionation.io, or consult@prionation.io with your company name and use case",
        ]}
      />
    </PlaceholderPage>
  );
}
