import { findOgEntry, ogEntries, renderOgImage } from "@/features/marketing/seo/og-image";

// Prerendered at build time, one image per landing page, blog post and
// comparison (see src/features/marketing/seo/og-image.tsx).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ogEntries().map(({ kind, locale, slug }) => ({ kind, locale, slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string; locale: string; slug: string }> }
) {
  const { kind, locale, slug } = await params;
  const entry = findOgEntry(kind, locale, slug);
  if (!entry) return new Response("Not found", { status: 404 });
  return renderOgImage(entry);
}
