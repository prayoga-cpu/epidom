"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function PainGainSection() {
  const { t } = useI18n();

  const oldItems = [
    t("redesign.oldVsNew.old1"),
    t("redesign.oldVsNew.old2"),
    t("redesign.oldVsNew.old3"),
    t("redesign.oldVsNew.old4"),
    t("redesign.oldVsNew.old5"),
  ];

  const newItems = [
    t("redesign.oldVsNew.new1"),
    t("redesign.oldVsNew.new2"),
    t("redesign.oldVsNew.new3"),
    t("redesign.oldVsNew.new4"),
    t("redesign.oldVsNew.new5"),
  ];

  return (
    <section className="epi-section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.oldVsNew.eyebrow")}</div>
          <h2
            className="epi-display"
            style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
          >
            {t("redesign.oldVsNew.title1")}<br />
            {t("redesign.oldVsNew.title2")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{t("redesign.oldVsNew.titleAccent")}</span>.
          </h2>
          <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, marginTop: 20, fontSize: 17, lineHeight: 1.55, maxWidth: 640, marginInline: "auto" }}>
            {t("redesign.oldVsNew.sub")}
          </p>
        </div>

        {/* Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ marginTop: 64, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}
        >
          {/* Old way */}
          <div style={{ padding: 36, borderRadius: 24, background: "rgba(254,43,43,0.04)", border: "1px solid rgba(254,43,43,0.18)" }}>
            <div style={{
              display: "inline-flex", padding: "4px 12px", borderRadius: 999,
              background: "rgba(254,43,43,0.10)", border: "1px solid rgba(254,43,43,0.30)",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FE6B6B",
              marginBottom: 20,
            }}>
              {t("redesign.oldVsNew.oldTag")}
            </div>
            <h3
              className="epi-display"
              style={{ fontSize: 36, margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
            >
              {t("redesign.oldVsNew.oldHeadline")}
            </h3>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              {oldItems.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 15, lineHeight: 1.5,
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(254,43,43,0.5)",
                }}>
                  <span style={{ color: "#FE6B6B", flexShrink: 0 }}>✕</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* With Epidom */}
          <div style={{
            padding: 36, borderRadius: 24,
            background: "linear-gradient(160deg, rgba(217,174,59,0.18), rgba(217,174,59,0.04))",
            border: "1px solid rgba(217,174,59,0.40)",
          }}>
            <div style={{
              display: "inline-flex", padding: "4px 12px", borderRadius: 999,
              background: "rgba(217,174,59,0.14)", border: "1px solid rgba(217,174,59,0.40)",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--epi-gold-300)",
              marginBottom: 20,
            }}>
              {t("redesign.oldVsNew.newTag")}
            </div>
            <h3
              className="epi-display"
              style={{ fontSize: 36, margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
            >
              {t("redesign.oldVsNew.newHeadline")}
            </h3>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              {newItems.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "var(--epi-cream-50)", fontSize: 15, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--epi-gold-400)", flexShrink: 0 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
