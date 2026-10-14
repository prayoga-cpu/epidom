import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { toLocale } from "@/features/marketing/seo/route-locale";
import { BREADCRUMB_LABELS, buildBreadcrumbs, buildLocalizedMetadata } from "@/lib/seo";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { getDocsGuides } from "@/features/marketing/docs/content";
import { DocsGuideView } from "@/features/marketing/docs/components/docs-guide-view";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/** Each language prerenders its own guides (slugs differ per language). */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getDocsGuides(toLocale(params.locale)).map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

async function resolveGuide(params: PageProps["params"]) {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const guides = getDocsGuides(locale);
  const index = guides.findIndex((g) => g.slug === slug);
  return { locale, slug, guides, guide: index >= 0 ? guides[index] : undefined, index };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, guide } = await resolveGuide(params);

  if (!guide) return { title: "Not found | Epidom" };

  // Guides are written per locale and their slugs differ, so a guide exists at
  // exactly one URL. Authored in [locale] only: hreflang claims that URL and
  // nothing else, instead of the /id and /en siblings that would 404.
  return buildLocalizedMetadata({
    basePath: `/docs/${slug}`,
    locale,
    title: `${guide.title} — EPIDOM`,
    description: guide.description,
    ogTitle: guide.title,
    authoredLocales: [locale],
  });
}

export default async function DocsGuidePage({ params }: PageProps) {
  const { locale, slug, guide, guides, index } = await resolveGuide(params);

  if (!guide) {
    notFound();
  }

  const nextGuide = index >= 0 && index < guides.length - 1 ? guides[index + 1] : undefined;

  return (
    <div className="w-full overflow-x-hidden">
      <BreadcrumbStructuredData
        items={buildBreadcrumbs(locale, [
          { name: BREADCRUMB_LABELS[locale].docs, path: "/docs" },
          { name: guide!.title, path: `/docs/${slug}` },
        ])}
      />
      <DocsGuideView locale={locale} guide={guide!} nextGuide={nextGuide} />
    </div>
  );
}
