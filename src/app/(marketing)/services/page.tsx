import type { Metadata } from "next";
import { HeroSection } from "@/features/marketing/services/components/hero-section";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";

export const metadata: Metadata = {
  title: "Fitur — EPIDOM",
  description:
    "Semua fitur Epidom dalam satu halaman: halaman menu gratis, kasir (POS), dapur (KDS), manajemen stok, laporan operasional, dan multi-outlet untuk bisnis F&B Indonesia.",
  keywords: [
    "fitur epidom",
    "aplikasi kasir warung",
    "pos restoran indonesia",
    "manajemen stok kafe",
    "halaman menu digital",
    "qris pembayaran",
    "kitchen display system",
    "laporan operasional f&b",
  ],
  openGraph: {
    title: "Fitur Lengkap EPIDOM — Platform F&B Indonesia",
    description:
      "Dari halaman menu gratis hingga kasir dan laporan operasional. Satu platform untuk warung, kafe, dan restoran Indonesia.",
    type: "website",
  },
};

export default function ServicesPage() {
  return (
    <main className="w-full overflow-x-hidden bg-bg-warm pt-20 md:pt-24">
      <div className="animate-slide-up">
        <HeroSection />
      </div>
      <div className="animate-slide-up-delayed">
        <FeaturesShowcaseSection />
      </div>
    </main>
  );
}
