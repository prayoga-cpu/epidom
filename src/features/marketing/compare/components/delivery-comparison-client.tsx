"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { FaqStructuredData } from "@/components/seo/structured-data";
import { trackEvent } from "@/lib/analytics";

const ROWS = ["r1", "r2", "r3", "r4", "r5"] as const;
const FAQS = ["1", "2", "3"] as const;

export function DeliveryComparisonClient() {
  const { t } = useI18n();
  const router = useRouter();

  const faqs = FAQS.map((n) => ({
    q: t(`compareDelivery.faq${n}q` as const),
    a: t(`compareDelivery.faq${n}a` as const),
  }));

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      <FaqStructuredData faqs={faqs} />

      {/* Hero */}
      <section className="epi-section" style={{ paddingTop: 140 }}>
        <div className="epi-container" style={{ maxWidth: 900 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>
            {t("compareDelivery.eyebrow")}
          </div>
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(36px, 6vw, 68px)",
              lineHeight: 1.05,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("compareDelivery.title1")} {t("compareDelivery.title2")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{t("compareDelivery.title3")}</span>
          </h1>
          <p
            style={{
              color: "rgba(251,249,228,0.65)",
              fontSize: 17,
              lineHeight: 1.7,
              maxWidth: 680,
              marginTop: 28,
            }}
          >
            {t("compareDelivery.lede")}
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="epi-section" style={{ paddingTop: 20 }}>
        <div className="epi-container">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table
              style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "33%" }} />
                <col style={{ width: "33%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ textAlign: "left", padding: "16px 12px", fontSize: 12 }} />
                  <th
                    style={{
                      textAlign: "left",
                      padding: "16px 12px",
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--epi-gold-400)",
                    }}
                  >
                    {t("compareDelivery.colEpidom")}
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "16px 12px",
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(251,249,228,0.5)",
                    }}
                  >
                    {t("compareDelivery.colDelivery")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td
                      style={{
                        padding: "18px 12px",
                        fontSize: 14,
                        color: "rgba(251,249,228,0.55)",
                      }}
                    >
                      {t(`compareDelivery.${r}feature` as const)}
                    </td>
                    <td style={{ padding: "18px 12px", fontSize: 15, color: "var(--epi-cream-50)" }}>
                      {t(`compareDelivery.${r}epidom` as const)}
                    </td>
                    <td
                      style={{
                        padding: "18px 12px",
                        fontSize: 15,
                        color: "rgba(251,249,228,0.55)",
                      }}
                    >
                      {t(`compareDelivery.${r}delivery` as const)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            style={{
              marginTop: 28,
              fontSize: 14,
              lineHeight: 1.7,
              color: "rgba(251,249,228,0.45)",
              maxWidth: 720,
            }}
          >
            {t("compareDelivery.note")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="epi-section">
        <div className="epi-container" style={{ maxWidth: 780 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16, color: "var(--epi-gold-500)" }}>
            {t("compareDelivery.faqEyebrow")}
          </div>
          <h2
            className="epi-display"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              margin: "0 0 32px",
              color: "var(--epi-cream-50)",
            }}
          >
            {t("compareDelivery.faqTitle")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {faqs.map((faq, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--epi-cream-50)",
                    marginBottom: 8,
                  }}
                >
                  {faq.q}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(251,249,228,0.6)" }}>
                  {faq.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "100px 24px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
        }}
      >
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(32px, 5vw, 56px)",
            margin: "0 0 32px",
            color: "var(--epi-cream-50)",
          }}
        >
          {t("compareDelivery.ctaTitle")}
        </h2>
        <button
          onClick={() => {
            trackEvent("cta_click", {
              event_category: "engagement",
              event_label: "compare_delivery_cta",
            });
            router.push("/register");
          }}
          className="cursor-pointer transition-all hover:-translate-y-px"
          style={{
            padding: "16px 36px",
            borderRadius: 999,
            border: "none",
            background: "var(--epi-gold-500)",
            color: "var(--epi-navy-900)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            fontFamily: "var(--epi-font-body)",
            boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
          }}
        >
          {t("compareDelivery.ctaButton")}
        </button>
      </section>
    </div>
  );
}
