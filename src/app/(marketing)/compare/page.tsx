import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { generateMetadata } from "@/lib/seo";
import { CompareHub } from "@/features/marketing/compare/components/compare-hub";

export const metadata = generateMetadata({
  title: "Compare Epidom — EPIDOM",
  description:
    "Factual, sourced comparisons between Epidom and the POS/ordering tools you already use.",
  canonical: "https://epidom.fr/compare",
});

export default async function ComparePage() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;

  return (
    <main className="w-full overflow-x-hidden">
      <CompareHub locale={locale} />
    </main>
  );
}
