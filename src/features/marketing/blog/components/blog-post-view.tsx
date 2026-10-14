import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import type { BlogPost } from "@/features/marketing/blog/content/types";
import { ArticleBody } from "@/features/marketing/shared/content/article-body";
import { ArticleCta } from "@/features/marketing/shared/components/article-cta";
import { BlogByline } from "@/features/marketing/blog/components/blog-byline";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { LANDING_LABELS, LANDING_SLUGS } from "@/features/marketing/landing/registry";

const COPY: Record<
  Locale,
  { back: string; ctaTitle: string; ctaBody: string; ctaButton: string; related: string }
> = {
  fr: {
    back: "← Retour au journal",
    related: "Outils et guides",
    ctaTitle: "Prêt à essayer ?",
    ctaBody: "Sans carte. Votre premier lien est gratuit pour toujours.",
    ctaButton: "Démarrer gratuitement →",
  },
  id: {
    back: "← Kembali ke blog",
    related: "Alat & panduan",
    ctaTitle: "Siap mencoba?",
    ctaBody: "Tanpa kartu. Link pertamamu gratis selamanya.",
    ctaButton: "Mulai gratis →",
  },
  en: {
    back: "← Back to journal",
    related: "Tools & guides",
    ctaTitle: "Ready to try it?",
    ctaBody: "No card. Your first link is free forever.",
    ctaButton: "Start free →",
  },
};

export function BlogPostView({ locale, post }: { locale: Locale; post: BlogPost }) {
  const copy = COPY[locale];
  // Only slugs that really are landing pages in this post's language.
  const relatedLinks = (post.related ?? [])
    .filter((slug) => LANDING_SLUGS.get(slug)?.locale === locale)
    .map((slug) => ({ href: getLocalizedPath(`/${slug}`, locale), label: LANDING_LABELS[slug] }));

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      <article className="epi-section" style={{ paddingTop: 140 }}>
        <div className="epi-container" style={{ maxWidth: 720 }}>
          <Link
            href={getLocalizedPath("/blog", locale)}
            style={{
              fontSize: 13,
              color: "rgba(251,249,228,0.45)",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
            className="transition-colors hover:text-[rgba(251,249,228,0.8)]"
          >
            {copy.back}
          </Link>

          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--epi-gold-500)",
              marginTop: 28,
              marginBottom: 16,
            }}
          >
            {post.category}
          </div>

          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(32px, 5.5vw, 60px)",
              lineHeight: 1.02,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {post.title}
          </h1>

          <p
            className="epi-script"
            style={{
              fontSize: 20,
              color: "var(--epi-gold-300)",
              marginTop: 22,
              lineHeight: 1.5,
              maxWidth: 620,
            }}
          >
            {post.description}
          </p>

          <BlogByline
            locale={locale}
            author={post.author}
            date={post.date}
            readMinutes={post.readMinutes}
          />

          <div className="epi-gold-rule" style={{ marginTop: 40, marginBottom: 40 }} />

          <ArticleBody blocks={post.blocks} />

          {/* The post's calculators and guides, in its own language. */}
          {relatedLinks.length > 0 && (
            <nav aria-label={copy.related} style={{ marginTop: 44 }}>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--epi-gold-500)",
                  marginBottom: 14,
                }}
              >
                {copy.related}
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 10px",
                }}
              >
                {relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center rounded-full border border-white/12 px-4 text-sm transition-colors hover:border-[rgba(217,174,59,0.5)]"
                      style={{ color: "rgba(251,249,228,0.8)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </article>

      <ArticleCta
        variant="section"
        title={copy.ctaTitle}
        body={copy.ctaBody}
        button={copy.ctaButton}
        trackLabel="blog_article_start_free"
      />
    </div>
  );
}
