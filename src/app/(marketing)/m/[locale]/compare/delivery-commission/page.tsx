import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { DeliveryComparisonClient } from "@/features/marketing/compare/components/delivery-comparison-client";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
import { BREADCRUMB_LABELS, buildBreadcrumbs } from "@/lib/seo";

export const generateMetadata = pageMetadata("compare-delivery-commission");

const PAGE_NAME = {
  fr: "Commissions des applis de livraison",
  id: "Komisi aplikasi pengantaran",
  en: "Delivery-app commission",
} as const;

export default async function DeliveryCommissionComparePage({ params }: LocaleParams) {
  const locale = await routeLocale(params);
  return (
    <div className="w-full overflow-x-hidden">
      <BreadcrumbStructuredData
        items={buildBreadcrumbs(locale, [
          { name: BREADCRUMB_LABELS[locale].compare, path: "/compare" },
          { name: PAGE_NAME[locale], path: "/compare/delivery-commission" },
        ])}
      />
      <DeliveryComparisonClient />
    </div>
  );
}
