import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { BuildWithUsClient } from "@/features/marketing/build-with-us/components/build-with-us-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("build-with-us");

export default async function BuildWithUsPage() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;

  return (
    <main className="w-full overflow-x-hidden">
      <BuildWithUsClient locale={locale} />
    </main>
  );
}
