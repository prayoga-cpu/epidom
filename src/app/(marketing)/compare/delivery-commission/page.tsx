import { generateMetadata } from "@/lib/seo";
import { DeliveryComparisonClient } from "@/features/marketing/compare/components/delivery-comparison-client";

export const metadata = generateMetadata({
  title: "Epidom vs. GoFood, GrabFood, ShopeeFood & Delivery-App Commission",
  description:
    "Every order through a delivery app pays a commission. A storefront you own doesn't. Compare Epidom's free, commission-free ordering to delivery-platform fees.",
  keywords: [
    "gofood commission",
    "grabfood commission indonesia",
    "shopeefood commission",
    "commission free online ordering",
    "avoid delivery app fees",
    "deliveroo commission restaurant",
  ],
  canonical: "https://epidom.fr/compare/delivery-commission",
});

export default function DeliveryCommissionComparePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <DeliveryComparisonClient />
    </main>
  );
}
