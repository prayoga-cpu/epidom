import type { Metadata } from "next";
import { PricingPageClient } from "@/features/marketing/pricing/components/pricing-page-client";

export const metadata: Metadata = {
  title: "Harga — EPIDOM",
  description:
    "Mulai gratis, berkembang sesuai kebutuhan. Paket harga Epidom untuk kafe, restoran, dan toko F&B di Indonesia.",
  keywords: [
    "harga epidom",
    "paket epidom",
    "biaya aplikasi kasir",
    "harga pos restoran",
    "epidom gratis",
  ],
  openGraph: {
    title: "Harga EPIDOM — Mulai Gratis",
    description:
      "Mulai gratis, berkembang sesuai kebutuhan. Paket harga Epidom untuk kafe, restoran, dan toko F&B di Indonesia.",
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
