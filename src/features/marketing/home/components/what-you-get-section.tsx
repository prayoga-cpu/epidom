"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";

export function WhatYouGetSection() {
  const { t } = useI18n();
  const router = useRouter();

  const features = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    index: String(n).padStart(2, "0"),
    title: t(`redesign.features.f${n}title`),
    body: t(`redesign.features.f${n}body`),
    hint: t(`redesign.features.f${n}hint`),
  }));

  return (
    <section className="epi-section">
      <div className="epi-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 40,
            marginBottom: 56,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
              {t("redesign.features.eyebrow")}
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
              {t("redesign.features.title1")}
              <br />
              {t("redesign.features.title2")}
            </h2>
            <p
              style={{
                color: "var(--epi-cream-50)",
                opacity: 0.72,
                marginTop: 16,
                fontSize: 16,
                lineHeight: 1.55,
                maxWidth: 520,
              }}
            >
              {t("redesign.features.sub")}
            </p>
          </div>
          <button
            onClick={() => router.push("/services")}
            className="cursor-pointer transition-all hover:-translate-y-px"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "var(--epi-cream-50)",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "var(--epi-font-body)",
              whiteSpace: "nowrap",
            }}
          >
            {t("redesign.features.fullList")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group transition-all hover:-translate-y-1"
              style={{
                padding: "20px 18px",
                borderRadius: 22,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                className="epi-script"
                aria-hidden="true"
                style={{
                  fontSize: 32,
                  lineHeight: 1,
                  color: "var(--epi-gold-500)",
                  opacity: 0.85,
                }}
              >
                {f.index}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--epi-font-display)",
                    fontSize: 20,
                    letterSpacing: "0.04em",
                    color: "var(--epi-cream-50)",
                    lineHeight: 1.1,
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </div>
                <p
                  style={{
                    color: "var(--epi-cream-50)",
                    opacity: 0.6,
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
              <div
                style={{
                  marginTop: "auto",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--epi-gold-500)",
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {f.hint}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
