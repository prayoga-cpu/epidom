"use client";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
export function CareersClient() {
  return (
    <PlaceholderPage
      eyebrow="Careers"
      title="Build the future of F&B ops."
      body="Epidom is built by Prionation's product team, working as a small, focused pod rather than a large fixed org. We don't have a running req list — but we're always glad to hear from people who want in."
    >
      <PlaceholderSection
        title="How we work"
        items={[
          "A small pod of AI product engineers, based in Bali and Paris, remote-friendly",
          "No open roles posted right now — reach out anyway if Epidom's mission fits what you're looking for",
        ]}
      />
      <PlaceholderSection
        title="Apply"
        items={[
          "Send your CV and a short note to cro@prionation.io, ceo@prionation.io, or consult@prionation.io",
        ]}
      />
    </PlaceholderPage>
  );
}
