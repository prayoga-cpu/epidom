"use client";

import { useRouter } from "next/navigation";
import { FaqStructuredData } from "@/components/seo/structured-data";
import { trackEvent } from "@/lib/analytics";
import type { CompetitorComparisonData } from "../types";

export function CompetitorComparison({ data }: { data: CompetitorComparisonData }) {
  const router = useRouter();

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      <FaqStructuredData faqs={data.faqs} />

      <section className="epi-section" style={{ paddingTop: 140 }}>
        <div className="epi-container" style={{ maxWidth: 900 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>
            {data.eyebrow}
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
            {data.titleParts[0]}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{data.titleParts[1]}</span>
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
            {data.lede}
          </p>
        </div>
      </section>

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
                    Epidom
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
                    {data.colCompetitor}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td
                      style={{ padding: "18px 12px", fontSize: 14, color: "rgba(251,249,228,0.55)" }}
                    >
                      {row.feature}
                    </td>
                    <td style={{ padding: "18px 12px", fontSize: 15, color: "var(--epi-cream-50)" }}>
                      {row.epidom}
                    </td>
                    <td
                      style={{ padding: "18px 12px", fontSize: 15, color: "rgba(251,249,228,0.55)" }}
                    >
                      {row.competitor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            style={{
              marginTop: 28,
              fontSize: 13,
              lineHeight: 1.7,
              color: "rgba(251,249,228,0.4)",
              maxWidth: 720,
            }}
          >
            {data.note}
          </p>
        </div>
      </section>

      <section className="epi-section">
        <div className="epi-container" style={{ maxWidth: 780 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16, color: "var(--epi-gold-500)" }}>
            {data.faqEyebrow}
          </div>
          <h2
            className="epi-display"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              margin: "0 0 32px",
              color: "var(--epi-cream-50)",
            }}
          >
            {data.faqTitle}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {data.faqs.map((faq, i) => (
              <div key={i}>
                <div
                  style={{ fontSize: 16, fontWeight: 600, color: "var(--epi-cream-50)", marginBottom: 8 }}
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
          style={{ fontSize: "clamp(32px, 5vw, 56px)", margin: "0 0 32px", color: "var(--epi-cream-50)" }}
        >
          {data.ctaTitle}
        </h2>
        <button
          onClick={() => {
            trackEvent("cta_click", { event_category: "engagement", event_label: `compare_${data.slug}_cta` });
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
          {data.ctaButton}
        </button>
      </section>
    </div>
  );
}
