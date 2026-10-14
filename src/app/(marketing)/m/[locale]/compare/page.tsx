import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
import { CompareHub } from "@/features/marketing/compare/components/compare-hub";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("compare");

export default async function ComparePage({ params }: LocaleParams) {
  const locale = await routeLocale(params);

  return (
    <div className="w-full overflow-x-hidden">
      <CompareHub locale={locale} />
    </div>
  );
}
