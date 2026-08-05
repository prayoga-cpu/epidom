"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
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
          "French/EU users: right to erasure and data portability under GDPR, and the right to lodge a complaint with the CNIL (Commission Nationale de l'Informatique et des Libertés)",
          "Indonesian users: data subject rights under UU PDP (Law No. 27 of 2022), including consent withdrawal and the right to complain to Indonesia's PDP supervisory authority",
        ]}
      />
      <PlaceholderSection
        title="Data retention & account deletion"
        items={[
          "Closing your account deactivates it for 30 days — log back in any time in that window to instantly restore full access, no data lost.",
          "After 30 days, self-service reactivation ends; recovery requires contacting support, who will quote a case-by-case fee before manually restoring access.",
          "Data is retained for up to 12 months from deactivation, after which the account and all associated data are permanently deleted.",
        ]}
      />
      <PlaceholderSection
        title="Contact"
        items={[
          "Data controller: Epidom / PRIONATION",
          "Email: cro@prionation.io, ceo@prionation.io, consult@prionation.io",
          "Response time: within 30 days as required by GDPR",
        ]}
      />
    </PlaceholderPage>
  );
}
