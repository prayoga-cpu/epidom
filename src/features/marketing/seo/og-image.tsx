import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "@/components/lang/i18n-provider";
import { getAllBlogPostParams, getBlogPost } from "@/features/marketing/blog/content";
import { COMPETITOR_COMPARISONS } from "@/features/marketing/compare/registry";
import { getAuthoredLocales } from "@/lib/seo";
import { LANDING_PAGES } from "@/features/marketing/landing/content";
import type { OgKind } from "./og-url";

/**
 * Share images (Open Graph / Twitter) for the pages people pass around:
 * landing pages, blog posts and comparisons, each with its own title in its
 * own language instead of one site-wide picture. Served from /og/<kind>/
 * <locale>/<slug> (src/app/og/…), prerendered at build time.
 */

export interface OgEntry {
  kind: OgKind;
  locale: Locale;
  slug: string;
  eyebrow: string;
  title: string;
}

export function ogEntries(): OgEntry[] {
  const landing = LANDING_PAGES.map((p) => ({
    kind: "landing" as const,
    locale: p.locale,
    slug: p.slug,
    eyebrow: p.eyebrow,
    title: p.h1,
  }));
  const blog = getAllBlogPostParams().map(({ locale, slug }) => {
    const post = getBlogPost(locale, slug)!;
    return { kind: "blog" as const, locale, slug, eyebrow: post.category, title: post.title };
  });
  const compare = COMPETITOR_COMPARISONS.flatMap((map) =>
    getAuthoredLocales(map).map((locale) => {
      const data = map[locale]!;
      return {
        kind: "compare" as const,
        locale,
        slug: data.slug,
        eyebrow: data.eyebrow,
        title: `${data.titleParts[0]} ${data.titleParts[1]}`,
      };
    })
  );
  return [...landing, ...blog, ...compare];
}

export function findOgEntry(kind: string, locale: string, slug: string): OgEntry | undefined {
  return ogEntries().find((e) => e.kind === kind && e.locale === locale && e.slug === slug);
}

const FOOTER: Record<Locale, string> = {
  fr: "Caisse, commande en ligne et back-office pour cafés",
  id: "Kasir, pesanan online, dan back office untuk kafe",
  en: "POS, online ordering and back office for cafés",
};

const NAVY = "#060f1b";
const GOLD = "#d9ae3b";
const CREAM = "#fbf9e4";

export async function renderOgImage(entry: OgEntry): Promise<ImageResponse> {
  // Literal paths, so the build traces exactly these three files (a path built
  // from variables makes it trace the whole project).
  const [bold, regular, icon] = await Promise.all([
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf")),
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "public/images/icon-192.png")),
  ]);
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;
  const titleSize = entry.title.length > 90 ? 52 : entry.title.length > 55 ? 62 : 74;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, ${NAVY} 0%, #0d1f35 100%)`,
          padding: "64px 76px",
          fontFamily: "Geist",
          borderBottom: `10px solid ${GOLD}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={64} height={64} style={{ borderRadius: 14 }} alt="" />
          <div style={{ color: CREAM, fontSize: 34, fontWeight: 700, letterSpacing: 8 }}>
            EPIDOM
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              color: GOLD,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            {entry.eyebrow}
          </div>
          <div
            style={{
              color: CREAM,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.08,
              maxWidth: 1040,
            }}
          >
            {entry.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(251,249,228,0.62)",
            fontSize: 24,
          }}
        >
          <span>epidom.fr</span>
          <span>{FOOTER[entry.locale]}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    }
  );
}
