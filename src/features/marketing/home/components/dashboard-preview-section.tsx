"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PosDashboard } from "@/features/marketing/shared/components/pos-dashboard";

export function DashboardPreviewSection() {
  const { t } = useI18n();

  return (
    <section
      className="epi-section"
      style={{
        background: "linear-gradient(180deg, transparent, rgba(11,26,40,0.4) 50%, transparent)",
      }}
    >
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.dashboard.eyebrow")}
          </div>
          <h2
            className="epi-display"
            style={{
              fontSize: "clamp(40px, 5vw, 72px)",
              margin: 0,
              lineHeight: 0.95,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("redesign.dashboard.title1")}
            <br />
            {t("redesign.dashboard.title2")}
          </h2>
          <p
            style={{
              color: "var(--epi-cream-50)",
              opacity: 0.72,
              marginTop: 20,
              fontSize: 17,
              lineHeight: 1.55,
              maxWidth: 600,
              marginInline: "auto",
            }}
          >
            {t("redesign.dashboard.sub")}
          </p>
        </div>

        {/* Dashboard mockup */}
        <div style={{ marginTop: 56, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: -40,
              background: "radial-gradient(circle, rgba(217,174,59,0.16), transparent 60%)",
              filter: "blur(40px)",
              zIndex: -1,
            }}
          />
          <PosDashboard />
        </div>
      </div>
    </section>
  );
}
