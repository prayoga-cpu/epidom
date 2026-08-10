import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { ArticleBody } from "@/features/marketing/shared/content/article-body";
import { getLocalizedPath } from "@/lib/i18n-routing";

const COPY: Record<Locale, { back: string; ctaTitle: string; ctaBody: string; ctaButton: string; readLabel: (m: number) => string }> = {
  fr: {
    back: "← Retour au journal",
    ctaTitle: "Prêt à essayer ?",
    ctaBody: "Cinq minutes. Sans carte. Votre premier lien est gratuit pour toujours.",
    ctaButton: "Démarrer gratuitement →",
    readLabel: (m) => `${m} min de lecture`,
  },
  id: {
    back: "← Kembali ke blog",
    ctaTitle: "Siap mencoba?",
    ctaBody: "Lima menit. Tanpa kartu. Link pertamamu gratis selamanya.",
    ctaButton: "Mulai gratis →",
    readLabel: (m) => `${m} menit baca`,
  },
  en: {
    back: "← Back to journal",
    ctaTitle: "Ready to try it?",
    ctaBody: "Five minutes. No card. Your first link is free forever.",
    ctaButton: "Start free →",
    readLabel: (m) => `${m} min read`,
  },
};

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "id" ? "id-ID" : locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BlogPostView({ locale, post }: { locale: Locale; post: Article }) {
  const copy = COPY[locale];

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
            {post.category} · {formatDate(post.date, locale)} · {copy.readLabel(post.readMinutes)}
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

          <div className="epi-gold-rule" style={{ marginTop: 40, marginBottom: 40 }} />

          <ArticleBody blocks={post.blocks} />
        </div>
      </article>

      <section
        style={{
          padding: "100px 24px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
        }}
      >
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(28px, 4.5vw, 48px)",
            margin: "0 0 16px",
            color: "var(--epi-cream-50)",
          }}
        >
          {copy.ctaTitle}
        </h2>
        <p style={{ fontSize: 16, color: "rgba(251,249,228,0.55)", marginBottom: 32 }}>{copy.ctaBody}</p>
        <a
          href="/register"
          style={{
            display: "inline-flex",
            padding: "16px 36px",
            borderRadius: 999,
            background: "var(--epi-gold-500)",
            color: "var(--epi-navy-900)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textDecoration: "none",
            boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
          }}
        >
          {copy.ctaButton}
        </a>
      </section>
    </div>
  );
}
