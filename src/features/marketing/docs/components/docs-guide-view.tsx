import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { ArticleBody } from "@/features/marketing/shared/content/article-body";
import { getLocalizedPath } from "@/lib/i18n-routing";

const COPY: Record<Locale, { back: string; next: string }> = {
  fr: { back: "← Tous les guides", next: "Suivant" },
  id: { back: "← Semua panduan", next: "Selanjutnya" },
  en: { back: "← All guides", next: "Next" },
};

export function DocsGuideView({
  locale,
  guide,
  nextGuide,
}: {
  locale: Locale;
  guide: Article;
  nextGuide?: Article;
}) {
  const copy = COPY[locale];

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      <article className="epi-section" style={{ paddingTop: 140 }}>
        <div className="epi-container" style={{ maxWidth: 720 }}>
          <Link
            href={getLocalizedPath("/docs", locale)}
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
            {guide.category}
          </div>

          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(30px, 5vw, 52px)",
              lineHeight: 1.05,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {guide.title}
          </h1>

          <div className="epi-gold-rule" style={{ marginTop: 36, marginBottom: 36 }} />

          <ArticleBody blocks={guide.blocks} />

          {nextGuide && (
            <Link
              href={getLocalizedPath(`/docs/${nextGuide.slug}`, locale)}
              style={{
                display: "block",
                marginTop: 64,
                padding: "24px 0",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(251,249,228,0.4)",
                }}
              >
                {copy.next}
              </span>
              <span
                className="epi-display"
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: "clamp(20px, 2.5vw, 28px)",
                  color: "var(--epi-cream-50)",
                }}
              >
                {nextGuide.title} →
              </span>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
