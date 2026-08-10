import { generateMetadata } from "@/lib/seo";
import { AboutPageClient } from "@/features/marketing/about/components/about-page-client";

export const metadata = generateMetadata({
  title: "About Epidom — Free F&B Storefront & POS",
  description:
    "We started with one café. The spreadsheet broke. Epidom was the fix. Learn about the team behind the platform.",
  keywords: ["about epidom", "epidom team", "f&b storefront company"],
  canonical: "https://epidom.fr/about",
  openGraph: {
    title: "About Epidom",
    description: "Built behind a real counter — the story of how Epidom started.",
    url: "https://epidom.fr/about",
  },
});

export default function AboutPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <AboutPageClient />
    </main>
  );
}
