import { generateMetadata } from "@/lib/seo";
import { PricingPageClient } from "@/features/marketing/pricing/components/pricing-page-client";

export const metadata = generateMetadata({
  title: "Pricing — EPIDOM",
  description:
    "Start free, grow as you need. Epidom pricing plans for cafés, warungs, and restaurants — free storefront forever, POS from Rp 229k/mo.",
  keywords: [
    "epidom pricing",
    "epidom plans",
    "pos cashier cost",
    "restaurant pos price",
    "free pos for restaurants",
    "epidom free plan",
    "harga aplikasi kasir",
    "moka pos vs epidom price",
  ],
  canonical: "https://epidom.fr/pricing",
  openGraph: {
    title: "Pricing — EPIDOM · Start Free",
    description:
      "Start free, grow as you need. Epidom pricing plans for cafés, restaurants, and F&B businesses worldwide.",
    url: "https://epidom.fr/pricing",
  },
});

export default function PricingPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <PricingPageClient />
    </main>
  );
}
