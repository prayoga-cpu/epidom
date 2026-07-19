"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function GdprClient() {
  return (
    <PlaceholderPage
      eyebrow="GDPR"
      title="Your rights under GDPR."
      body="Epidom is committed to GDPR compliance. This page explains the legal bases we rely on, the rights you hold, and how to exercise them."
    >
      <PlaceholderSection
        title="Legal bases for processing"
        items={[
          "Contract performance — processing your account data to deliver the service",
          "Legitimate interests — fraud prevention and platform security",
          "Consent — analytics and marketing communications (opt-in only)",
        ]}
      />
      <PlaceholderSection
        title="Your rights"
        items={[
          "Right of access — request a full export of your data",
          "Right to rectification — correct inaccurate data at any time",
          "Right to erasure — delete your account and all associated data",
          "Right to portability — receive your data in a machine-readable format",
          "Right to object — opt out of any processing based on legitimate interests",
          "Right to restrict processing — pause processing while a dispute is resolved",
        ]}
      />
      <PlaceholderSection
        title="Data transfers"
        items={[
          "Data is stored in EU-region servers (Frankfurt)",
          "Any transfers outside the EEA rely on Standard Contractual Clauses",
        ]}
      />
      <PlaceholderSection
        title="DPO contact"
        items={[
          "Data Protection Officer: cro@prionation.io, ceo@prionation.io, consult@prionation.io",
          "You may also lodge a complaint with your national supervisory authority",
        ]}
      />
    </PlaceholderPage>
  );
}
