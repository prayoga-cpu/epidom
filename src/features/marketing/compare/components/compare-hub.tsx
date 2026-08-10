import Link from "next/link";
import type { Locale } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { COMPARE_HUB_ENTRIES } from "../hub-data";

const COPY: Record<Locale, { eyebrow: string; title: string; body: string }> = {
  fr: {
    eyebrow: "Comparatifs",
    title: "Epidom face à ce que vous utilisez déjà.",
    body: "Des comparaisons factuelles, sourcées sur les sites officiels de chaque outil — pas de chiffres inventés.",
  },
  id: {
    eyebrow: "Perbandingan",
    title: "Epidom dibanding yang udah kamu pakai.",
    body: "Perbandingan berdasarkan fakta, bersumber dari situs resmi masing-masing — nggak ada angka karangan.",
  },
  en: {
    eyebrow: "Comparisons",
    title: "Epidom against what you already use.",
    body: "Factual comparisons, sourced from each tool's own official site — no invented numbers.",
  },
};

export function CompareHub({ locale }: { locale: Locale }) {
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
            {COMPARE_HUB_ENTRIES.map((entry) => (
              <Link
                key={entry.slug}
                href={getLocalizedPath(`/compare/${entry.slug}`, locale)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 24,
                  padding: "28px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                }}
              >
                <span>
                  <span
                    className="epi-display"
                    style={{
                      display: "block",
                      fontSize: "clamp(20px, 2.4vw, 28px)",
                      color: "var(--epi-cream-50)",
                    }}
                  >
                    vs. {entry.name}
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
                    {entry.blurb[locale]}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  style={{ color: "var(--epi-gold-500)", fontSize: 20, flexShrink: 0 }}
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
