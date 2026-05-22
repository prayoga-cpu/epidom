import type { Metadata } from "next";
import { AboutPageClient } from "@/features/marketing/about/components/about-page-client";

export const metadata: Metadata = {
  title: "About — EPIDOM",
  description:
    "We started with one café. The spreadsheet broke. Epidom was the fix. Learn about the team behind the platform.",
  openGraph: {
    title: "About EPIDOM",
    description: "Built behind a real counter — the story of how Epidom started.",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <AboutPageClient />
    </main>
  );
}
