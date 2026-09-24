"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { CheckMark, PlanPill } from "./plan-pill";

// Epidom 3's split: the storefront customers see, POS Mode for the counter and
// the Back Office for owners and managers (CHANGELOG 3.0.0).
const SPACES = ["s1", "s2", "s3"] as const;

export function SpacesSection() {
  const { t } = useI18n();

  return (
    <section className="epi-section epi-section--tight">
      <div className="epi-container">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 48 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.servicesPage.spacesEyebrow")}
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
            {t("redesign.servicesPage.spacesTitle1")}
            <br />
            <span style={{ color: "var(--epi-gold-400)" }}>
              {t("redesign.servicesPage.spacesTitle2")}
            </span>
          </h2>
          <p
            style={{
              color: "var(--epi-cream-50)",
              opacity: 0.72,
              marginTop: 20,
              fontSize: 17,
              lineHeight: 1.55,
            }}
          >
            {t("redesign.servicesPage.spacesSub")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SPACES.map((key, i) => (
            <div
              key={key}
              style={{
                padding: 28,
                borderRadius: 22,
                background:
                  i === 1
                    ? "linear-gradient(180deg, rgba(217,174,59,0.12), rgba(217,174,59,0.03))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border:
                  i === 1 ? "1px solid rgba(217,174,59,0.30)" : "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div
                    className="epi-display"
                    style={{
                      fontSize: 30,
                      letterSpacing: "0.04em",
                      color: "var(--epi-cream-50)",
                      lineHeight: 1,
                    }}
                  >
                    {t(`redesign.servicesPage.${key}tag`)}
                  </div>
                  <PlanPill label={t(`redesign.servicesPage.${key}plan`)} />
                </div>
                <div
                  className="epi-script"
                  style={{ fontSize: 20, color: "var(--epi-gold-300)", marginTop: 8 }}
                >
                  {t(`redesign.servicesPage.${key}who`)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      color: "var(--epi-cream-50)",
                      fontSize: 14,
                      lineHeight: 1.4,
                    }}
                  >
                    <CheckMark />
                    {t(`redesign.servicesPage.${key}i${n}`)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
