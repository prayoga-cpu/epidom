"use client";
import { PlaceholderPage, PlaceholderSection } from "@/features/marketing/shared/components/placeholder-page";
export function CareersClient() {
  return (
    <PlaceholderPage
      eyebrow="Careers"
      title="Build the future of F&B ops."
      body="We're a small team with a big mission: give every independent food business the tools that enterprise chains take for granted. Join us."
    >
      <PlaceholderSection
        title="Open roles"
        items={[
          "Full-stack Engineer (Next.js / Rust) — Remote",
          "Product Designer (Mobile & Web) — Remote",
          "F&B Partnerships Lead — Jakarta / Remote",
        ]}
      />
      <PlaceholderSection
        title="What we offer"
        items={[
          "Fully remote-first culture with async-first communication",
          "Equity in a fast-growing SaaS product",
          "Budget for courses, conferences, and hardware",
          "Meaningful work — every line of code helps real shop owners",
        ]}
      />
      <PlaceholderSection
        title="Apply"
        items={["Send your CV and a short note to careers@epidom.app"]}
      />
    </PlaceholderPage>
  );
}
