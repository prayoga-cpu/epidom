import { PricingPageClient } from "@/features/marketing/pricing/components/pricing-page-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("pricing");

export default function PricingPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <PricingPageClient />
    </main>
  );
}
