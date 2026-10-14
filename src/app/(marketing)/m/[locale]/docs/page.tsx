import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
import { getDocsGuides } from "@/features/marketing/docs/content";
import { DocsList } from "@/features/marketing/docs/components/docs-list";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("docs");

export default async function DocsPage({ params }: LocaleParams) {
  const locale = await routeLocale(params);
  const guides = getDocsGuides(locale);

  return (
    <div className="w-full overflow-x-hidden">
      <DocsList locale={locale} guides={guides} />
    </div>
  );
}
