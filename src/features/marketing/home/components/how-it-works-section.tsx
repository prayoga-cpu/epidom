"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function HowItWorksSection() {
  const { t } = useI18n();

  const steps = [
    {
      n: t("redesign.oneLink.step1n"),
      t: t("redesign.oneLink.step1t"),
      b: t("redesign.oneLink.step1b"),
    },
    {
      n: t("redesign.oneLink.step2n"),
      t: t("redesign.oneLink.step2t"),
      b: t("redesign.oneLink.step2b"),
    },
    {
      n: t("redesign.oneLink.step3n"),
      t: t("redesign.oneLink.step3t"),
      b: t("redesign.oneLink.step3b"),
    },
  ];

  return (
    <section className="epi-section">
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.oneLink.eyebrow")}
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
            {t("redesign.oneLink.title1")}
            <br />
            {t("redesign.oneLink.title2")}
          </h2>
          <p
            style={{
              color: "var(--epi-cream-50)",
              opacity: 0.72,
              marginTop: 20,
              fontSize: 17,
              lineHeight: 1.55,
              maxWidth: 640,
              marginInline: "auto",
            }}
          >
            {t("redesign.oneLink.sub")}
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Gold connector */}
          <div
            className="hidden md:block"
            style={{
              position: "absolute",
              top: 50,
              left: "12%",
              right: "12%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(217,174,59,0.5), rgba(217,174,59,0.5), transparent)",
            }}
          />
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "24px 20px",
                borderRadius: 22,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.10)",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--epi-navy-900)",
                  border: "1px solid rgba(217,174,59,0.4)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--epi-font-display)",
                  fontSize: 22,
                  letterSpacing: "0.04em",
                  color: "var(--epi-gold-400)",
                  marginBottom: 24,
                }}
              >
                {s.n}
              </div>
              <div
                style={{
                  fontFamily: "var(--epi-font-display)",
                  fontSize: 26,
                  letterSpacing: "0.04em",
                  color: "var(--epi-cream-50)",
                  marginBottom: 10,
                }}
              >
                {s.t}
              </div>
              <div
                style={{
                  color: "var(--epi-cream-50)",
                  opacity: 0.72,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {s.b}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
