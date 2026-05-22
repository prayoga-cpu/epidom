"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";

/* ── Feature SVG icons (inline, no deps) ── */
function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconQr() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 22h4M22 14v4" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
    </svg>
  );
}
function IconKitchen() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}
function IconWhatsapp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" opacity=".9" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.552 4.122 1.523 5.854L0 24l6.335-1.492A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.882 0-3.659-.5-5.2-1.378l-.372-.215-3.758.884.934-3.65-.236-.389A10 10 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

const ICONS = [IconCamera, IconQr, IconCard, IconKitchen, IconReceipt, IconChart, IconWhatsapp, IconStore];

export function WhatYouGetSection() {
  const { t } = useI18n();
  const router = useRouter();

  const features = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    Icon: ICONS[n - 1],
    title: t(`redesign.features.f${n}title`),
    body: t(`redesign.features.f${n}body`),
    hint: t(`redesign.features.f${n}hint`),
  }));

  return (
    <section className="epi-section">
      <div className="epi-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginBottom: 56, flexWrap: "wrap" }}>
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.features.eyebrow")}</div>
            <h2 className="epi-display" style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}>
              {t("redesign.features.title1")}<br />{t("redesign.features.title2")}
            </h2>
            <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, marginTop: 16, fontSize: 16, lineHeight: 1.55, maxWidth: 520 }}>
              {t("redesign.features.sub")}
            </p>
          </div>
          <button
            onClick={() => router.push("/services")}
            className="cursor-pointer transition-all hover:-translate-y-px"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "var(--epi-cream-50)", padding: "12px 24px", borderRadius: 999, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)", whiteSpace: "nowrap" }}
          >
            {t("redesign.features.fullList")}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 18 }}>
          {features.map((f, i) => (
            <div
              key={i}
              className="group transition-all hover:-translate-y-1"
              style={{ padding: 28, borderRadius: 22, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(217,174,59,0.10)",
                border: "1px solid rgba(217,174,59,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--epi-gold-400)",
                flexShrink: 0,
              }}>
                <f.Icon />
              </div>
              <div>
                <div style={{ fontFamily: "var(--epi-font-display)", fontSize: 20, letterSpacing: "0.04em", color: "var(--epi-cream-50)", lineHeight: 1.1, marginBottom: 8 }}>{f.title}</div>
                <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
              </div>
              <div style={{ marginTop: "auto", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--epi-gold-500)", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>{f.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
