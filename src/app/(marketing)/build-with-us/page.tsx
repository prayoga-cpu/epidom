import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE, getLocalizedPath } from "@/lib/i18n-routing";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { BuildWithUsClient } from "@/features/marketing/build-with-us/components/build-with-us-client";

export async function generateMetadata() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const canonical = `https://epidom.fr${getLocalizedPath("/build-with-us", locale)}`;

  return buildMetadata({
    title: "Build Your Own Epidom — EPIDOM × Prionation",
    description:
      "Epidom is a Prionation build. If you're building a production SaaS, talk to the team that built this one — based in Canggu, Bali.",
    canonical,
    openGraph: {
      title: "Build Your Own Epidom",
      description: "Epidom is a Prionation build. Talk to the team that built this one.",
      url: canonical,
    },
  });
}

export default async function BuildWithUsPage() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;

  return (
    <main className="w-full overflow-x-hidden">
      <BuildWithUsClient locale={locale} />
    </main>
  );
}
