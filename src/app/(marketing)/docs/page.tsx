import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { generateMetadata } from "@/lib/seo";
import { getDocsGuides } from "@/features/marketing/docs/content";
import { DocsList } from "@/features/marketing/docs/components/docs-list";

export const metadata = generateMetadata({
  title: "Docs & Help Center — EPIDOM",
  description: "Step-by-step guides for setting up your storefront, menu, orders, and POS cashier.",
  canonical: "https://epidom.fr/docs",
});

export default async function DocsPage() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const guides = getDocsGuides(locale);

  return (
    <main className="w-full overflow-x-hidden">
      <DocsList locale={locale} guides={guides} />
    </main>
  );
}
