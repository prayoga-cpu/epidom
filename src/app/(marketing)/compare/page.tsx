import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { CompareHub } from "@/features/marketing/compare/components/compare-hub";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("compare");

export default async function ComparePage() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;

  return (
    <main className="w-full overflow-x-hidden">
      <CompareHub locale={locale} />
    </main>
  );
}
