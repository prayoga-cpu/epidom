"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section
      style={{
        paddingTop: 140,
        paddingBottom: 60,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -100,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(217,174,59,0.18), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div className="epi-container" style={{ position: "relative" }}>
        <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
          {t("redesign.servicesPage.eyebrow")}
        </div>
        <h1
          className="epi-display"
          style={{
            fontSize: "clamp(48px, 8vw, 128px)",
            margin: 0,
            lineHeight: 0.95,
            paddingBottom: 12,
            color: "var(--epi-cream-50)",
          }}
        >
          {t("redesign.servicesPage.title1")}
          <br />
          <span style={{ color: "var(--epi-gold-400)" }}>
            {t("redesign.servicesPage.titleAccent")}
          </span>
        </h1>
        <p
          className="epi-script"
          style={{
            fontSize: "clamp(20px, 2.4vw, 28px)",
            color: "var(--epi-cream-100)",
            marginTop: 20,
            maxWidth: 640,
            display: "block",
          }}
        >
          {t("redesign.servicesPage.script")}
        </p>
      </div>
    </section>
  );
}
