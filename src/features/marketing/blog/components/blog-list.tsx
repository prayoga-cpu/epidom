import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { getLocalizedPath } from "@/lib/i18n-routing";

const COPY: Record<Locale, { eyebrow: string; title: string; body: string; readLabel: (m: number) => string }> = {
  fr: {
    eyebrow: "Journal",
    title: "Notes de terrain, pas de vent marketing.",
    body: "Guides pratiques pour gérants de café et de restaurant — mise en place, commande directe, opérations.",
    readLabel: (m) => `${m} min de lecture`,
  },
  id: {
    eyebrow: "Blog",
    title: "Panduan dari lapangan, bukan basa-basi.",
    body: "Panduan praktis buat pemilik warung dan kafe — setup, jualan langsung, operasional harian.",
    readLabel: (m) => `${m} menit baca`,
  },
  en: {
    eyebrow: "Journal",
    title: "Field notes, not marketing fluff.",
    body: "Practical guides for café and restaurant owners — setup, direct ordering, day-to-day operations.",
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

export function BlogList({ locale, posts }: { locale: Locale; posts: Article[] }) {
  const copy = COPY[locale];

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      <section className="epi-section" style={{ paddingTop: 140, paddingBottom: 40 }}>
        <div className="epi-container" style={{ maxWidth: 780 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 20 }}>
            {copy.eyebrow}
          </div>
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(40px, 6vw, 76px)",
              lineHeight: 0.98,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {copy.title}
          </h1>
          <p
            style={{
              color: "rgba(251,249,228,0.6)",
              fontSize: 17,
              lineHeight: 1.7,
              maxWidth: 560,
              marginTop: 24,
            }}
          >
            {copy.body}
          </p>
        </div>
      </section>

      <section className="epi-section" style={{ paddingTop: 0 }}>
        <div className="epi-container" style={{ maxWidth: 780 }}>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={getLocalizedPath(`/blog/${post.slug}`, locale)}
                style={{
                  display: "block",
                  padding: "36px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                }}
                className="group"
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--epi-gold-500)",
                    marginBottom: 12,
                  }}
                >
                  {post.category} · {formatDate(post.date, locale)} · {copy.readLabel(post.readMinutes)}
                </div>
                <h2
                  className="epi-display"
                  style={{
                    fontSize: "clamp(24px, 3vw, 34px)",
                    lineHeight: 1.1,
                    margin: 0,
                    color: "var(--epi-cream-50)",
                  }}
                >
                  {post.title}
                </h2>
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "rgba(251,249,228,0.55)",
                    maxWidth: 620,
                  }}
                >
                  {post.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
