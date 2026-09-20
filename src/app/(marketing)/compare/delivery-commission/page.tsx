import { DeliveryComparisonClient } from "@/features/marketing/compare/components/delivery-comparison-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("compare-delivery-commission");

export default function DeliveryCommissionComparePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <DeliveryComparisonClient />
    </main>
  );
}
