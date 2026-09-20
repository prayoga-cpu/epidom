import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { buildLocalizedMetadata } from "@/lib/seo";
import { getDocsGuides } from "@/features/marketing/docs/content";
import { DocsGuideView } from "@/features/marketing/docs/components/docs-guide-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function resolveGuide(slug: string) {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const guides = getDocsGuides(locale);
  const index = guides.findIndex((g) => g.slug === slug);
  return { locale, guides, guide: index >= 0 ? guides[index] : undefined, index };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { locale, guide } = await resolveGuide(slug);

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
  const { slug } = await params;
  const { locale, guide, guides, index } = await resolveGuide(slug);

  if (!guide) {
    notFound();
  }

  const nextGuide = index >= 0 && index < guides.length - 1 ? guides[index + 1] : undefined;

  return (
    <main className="w-full overflow-x-hidden">
      <DocsGuideView locale={locale} guide={guide!} nextGuide={nextGuide} />
    </main>
  );
}
