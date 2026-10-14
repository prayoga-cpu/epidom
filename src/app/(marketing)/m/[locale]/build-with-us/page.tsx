import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
import { BuildWithUsClient } from "@/features/marketing/build-with-us/components/build-with-us-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("build-with-us");

export default async function BuildWithUsPage({ params }: LocaleParams) {
  const locale = await routeLocale(params);

  return (
    <div className="w-full overflow-x-hidden">
      <BuildWithUsClient locale={locale} />
    </div>
  );
}
