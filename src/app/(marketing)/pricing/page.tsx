import type { Metadata } from "next";
import { PricingPageClient } from "@/features/marketing/pricing/components/pricing-page-client";

export const metadata: Metadata = {
  title: "Pricing — EPIDOM",
  description:
    "Start free, grow as you need. Epidom pricing plans for cafés, restaurants, and F&B businesses worldwide.",
  keywords: [
    "epidom pricing",
    "epidom plans",
    "pos cashier cost",
    "restaurant pos price",
    "free pos for restaurants",
    "epidom free plan",
  ],
  openGraph: {
    title: "Pricing — EPIDOM · Start Free",
    description:
      "Start free, grow as you need. Epidom pricing plans for cafés, restaurants, and F&B businesses worldwide.",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <PricingPageClient />
    </main>
  );
}
