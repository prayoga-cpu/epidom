"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

const CASE_KEYS = ["cafe", "restaurant", "cookie", "warung"] as const;
type CaseKey = (typeof CASE_KEYS)[number];

export function UseCasesSection() {
  const { t } = useI18n();
  const [active, setActive] = useState<number>(0);

  const uc = CASE_KEYS[active];

  return (
    <section className="epi-section">
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.useCases.eyebrow")}
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
            {t("redesign.useCases.title1")}
            <br />
            {t("redesign.useCases.title2")}
            <br />
            {t("redesign.useCases.title3")}
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
            {t("redesign.useCases.sub")}
          </p>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            justifyContent: "center",
            marginTop: 48,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
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
                borderBottom:
                  i === active ? "2px solid var(--epi-gold-500)" : "2px solid transparent",
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
            background: "linear-gradient(160deg, #0E1F38, #060F1B)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Overlay gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(6,15,27,0.92) 0%, rgba(6,15,27,0.55) 60%, rgba(6,15,27,0.3) 100%)",
            }}
          />

          {/* One centred column: the tabs and heading above are centred too, so the
              panel reads as a single message per vertical. There are deliberately
              no testimonials or outcome stats here: none were ever sourced. */}
          <div className="relative mx-auto max-w-3xl px-6 py-12 text-center sm:px-10 lg:px-14 lg:py-16">
            <h3
              className="epi-display"
              style={{
                fontSize: "clamp(36px, 4.2vw, 64px)",
                margin: 0,
                lineHeight: 0.95,
                color: "var(--epi-cream-50)",
              }}
            >
              {t(`redesign.useCases.${uc}_headline` as const)}
            </h3>
            <p
              style={{
                color: "var(--epi-cream-50)",
                opacity: 0.72,
                fontSize: 16,
                lineHeight: 1.6,
                marginTop: 20,
                marginInline: "auto",
                maxWidth: 560,
              }}
            >
              {t(`redesign.useCases.${uc}_body` as const)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
