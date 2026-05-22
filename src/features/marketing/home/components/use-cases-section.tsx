"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

const CASE_KEYS = ["cafe", "restaurant", "cookie", "warung"] as const;
type CaseKey = typeof CASE_KEYS[number];

export function UseCasesSection() {
  const { t } = useI18n();
  const [active, setActive] = useState<number>(0);

  const uc = CASE_KEYS[active];

  return (
    <section className="epi-section">
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.useCases.eyebrow")}</div>
          <h2
            className="epi-display"
            style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
          >
            {t("redesign.useCases.title1")}<br />
            {t("redesign.useCases.title2")}<br />
            {t("redesign.useCases.title3")}
          </h2>
          <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, marginTop: 20, fontSize: 17, lineHeight: 1.55, maxWidth: 600, marginInline: "auto" }}>
            {t("redesign.useCases.sub")}
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 48, marginBottom: 32, flexWrap: "wrap" }}>
          {CASE_KEYS.map((key, i) => (
            <button
              key={key}
              onClick={() => setActive(i)}
              className="cursor-pointer transition-colors"
              style={{
                padding: "12px 22px",
                fontFamily: "var(--epi-font-display)",
                fontSize: 18,
                letterSpacing: "0.08em",
                background: "transparent",
                color: i === active ? "var(--epi-cream-50)" : "rgba(251,249,228,0.35)",
                border: "none",
                borderBottom: i === active ? "2px solid var(--epi-gold-500)" : "2px solid transparent",
              }}
            >
              {t(`redesign.useCases.${key}` as const)}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div
          style={{
            position: "relative",
            borderRadius: 32,
            overflow: "hidden",
            minHeight: 480,
            background: "linear-gradient(160deg, #0E1F38, #060F1B)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Overlay gradient */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(6,15,27,0.92) 0%, rgba(6,15,27,0.55) 60%, rgba(6,15,27,0.3) 100%)" }} />

          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ position: "relative", padding: "56px 56px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 48, alignItems: "center" }}
          >
            {/* Left */}
            <div>
              <h3
                className="epi-display"
                style={{ fontSize: "clamp(36px, 4.2vw, 64px)", margin: 0, lineHeight: 0.95, maxWidth: 540, color: "var(--epi-cream-50)" }}
              >
                {t(`redesign.useCases.${uc}_headline` as const)}
              </h3>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, fontSize: 16, lineHeight: 1.6, marginTop: 20, maxWidth: 520 }}>
                {t(`redesign.useCases.${uc}_body` as const)}
              </p>
              <div style={{ display: "flex", gap: 40, marginTop: 40, flexWrap: "wrap" }}>
                {[
                  { v: t(`redesign.useCases.${uc}_stat1v` as const), l: t(`redesign.useCases.${uc}_stat1l` as const) },
                  { v: t(`redesign.useCases.${uc}_stat2v` as const), l: t(`redesign.useCases.${uc}_stat2l` as const) },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="epi-display" style={{ fontSize: 56, color: "var(--epi-gold-400)", letterSpacing: "0.02em", lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--epi-cream-50)", opacity: 0.4, marginTop: 8 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — quote card */}
            <div style={{ padding: 32, borderRadius: 22, background: "rgba(245,244,220,0.06)", border: "1px solid rgba(245,244,220,0.18)", backdropFilter: "blur(12px)" }}>
              <div className="epi-display" style={{ fontSize: 50, color: "var(--epi-gold-300)", lineHeight: 0.6, marginBottom: 14 }}>&ldquo;</div>
              <p className="epi-script" style={{ fontSize: 22, color: "var(--epi-cream-50)", lineHeight: 1.35 }}>
                {t(`redesign.useCases.${uc}_quote` as const)}
              </p>
              <div style={{ fontSize: 12, color: "var(--epi-cream-50)", opacity: 0.5, marginTop: 20, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t(`redesign.useCases.${uc}_by` as const)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
