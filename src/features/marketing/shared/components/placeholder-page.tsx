"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  body: string;
  /** Optional extra content below the body */
  children?: React.ReactNode;
}

export function PlaceholderPage({ eyebrow, title, body, children }: PlaceholderPageProps) {
  const { t } = useI18n();
  return (
    <div style={{ fontFamily: "var(--epi-font-body)", minHeight: "80vh", display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: 0, right: 0, width: 500, height: 400, background: "radial-gradient(ellipse at top right, rgba(217,174,59,0.10), transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <section style={{ flex: 1, maxWidth: 860, margin: "0 auto", padding: "140px 32px 100px", width: "100%", position: "relative", zIndex: 1 }}>
        <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>{eyebrow}</div>
        <h1 className="epi-display" style={{ fontSize: "clamp(52px, 8vw, 96px)", lineHeight: 0.93, margin: "0 0 28px", color: "var(--epi-cream-50)" }}>
          {title}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.75, color: "rgba(251,249,228,0.6)", maxWidth: 640, margin: 0 }}>
          {body}
        </p>

        {children}

        <div style={{ marginTop: 56, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/"
            style={{ fontSize: 13, color: "rgba(251,249,228,0.45)", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}
            className="hover:text-[rgba(251,249,228,0.8)] transition-colors"
          >
            ← {t("notFound.backToHome")}
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Reusable section divider with a heading for placeholder content blocks */
export function PlaceholderSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 56, paddingTop: 48, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <h2 style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--epi-gold-500)", fontWeight: 700, marginBottom: 24 }}>
        {title}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--epi-gold-500)", marginTop: 8, flexShrink: 0 }} />
            <span style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(251,249,228,0.65)" }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
