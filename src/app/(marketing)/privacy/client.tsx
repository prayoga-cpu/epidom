"use client";
import { PlaceholderPage, PlaceholderSection } from "@/features/marketing/shared/components/placeholder-page";
export function PrivacyClient() {
  return (
    <PlaceholderPage
      eyebrow="Privacy Policy"
      title="Your data, your rights."
      body="We collect only what we need, store it securely, and never sell it. This page outlines exactly what we collect, why, and how long we keep it."
    >
      <PlaceholderSection
        title="What we collect"
        items={[
          "Account information: email address and display name",
          "Usage analytics — anonymised and aggregated, with consent",
          "Payment data — handled by Stripe; we never store card details",
          "Device and browser info for security and support purposes",
        ]}
      />
      <PlaceholderSection
        title="Your rights"
        items={[
          "Access a copy of the personal data we hold about you",
          "Request correction or deletion of your data at any time",
          "Withdraw consent for analytics at any time from Settings",
          "Lodge a complaint with your local data protection authority",
        ]}
      />
      <PlaceholderSection
        title="Contact"
        items={[
          "Data controller: Epidom / PRIONATION",
          "Email: privacy@epidom.app",
          "Response time: within 30 days as required by GDPR",
        ]}
      />
    </PlaceholderPage>
  );
}
