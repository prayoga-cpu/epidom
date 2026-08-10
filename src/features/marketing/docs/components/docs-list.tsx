import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { getLocalizedPath } from "@/lib/i18n-routing";

const COPY: Record<Locale, { eyebrow: string; title: string; body: string }> = {
  fr: {
    eyebrow: "Aide",
    title: "Tout pour bien démarrer.",
    body: "Guides pas à pas pour mettre en place votre vitrine, votre menu, et passer à la caisse quand vous êtes prêt.",
  },
  id: {
    eyebrow: "Bantuan",
    title: "Semua yang kamu butuhin buat mulai.",
    body: "Panduan langkah demi langkah buat setup toko, menu, dan upgrade ke kasir kalau udah siap.",
  },
  en: {
    eyebrow: "Help center",
    title: "Everything to get you set up.",
    body: "Step-by-step guides for your storefront, your menu, and moving to the POS cashier when you're ready.",
  },
};

export function DocsList({ locale, guides }: { locale: Locale; guides: Article[] }) {
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
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {guides.map((guide, i) => (
              <Link
                key={guide.slug}
                href={getLocalizedPath(`/docs/${guide.slug}`, locale)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 24,
                  padding: "26px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                }}
              >
                <span
                  className="epi-display"
                  style={{
                    fontSize: 20,
                    color: "var(--epi-gold-500)",
                    flexShrink: 0,
                    width: 32,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="epi-display"
                    style={{
                      display: "block",
                      fontSize: "clamp(18px, 2vw, 24px)",
                      lineHeight: 1.2,
                      color: "var(--epi-cream-50)",
                    }}
                  >
                    {guide.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "rgba(251,249,228,0.5)",
                    }}
                  >
                    {guide.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
