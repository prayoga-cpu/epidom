"use client";

import { useI18n } from "@/components/lang/i18n-provider";

const shops = [
  "Warung Sari",
  "Café Bretonne",
  "Maison Lacroix",
  "Kopi Tujuh",
  "Cookie Atelier",
  "Le Petit Bar",
];

export function TrustBar() {
  const { t } = useI18n();

  return (
    <section
      style={{
        padding: "40px 0",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="epi-container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "var(--epi-cream-50)",
            opacity: 0.5,
            fontFamily: "var(--epi-font-body)",
          }}
        >
          {t("redesign.trust.label")}
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {shops.map((name) => (
            <span
              key={name}
              className="epi-script"
              style={{
                color: "var(--epi-cream-50)",
                opacity: 0.72,
                fontSize: 22,
                letterSpacing: "0.01em",
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
