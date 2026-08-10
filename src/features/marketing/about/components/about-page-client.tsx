"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";

const STATS = ["stat1", "stat2", "stat3", "stat4"] as const;
const VALUES = ["v1", "v2", "v3"] as const;

export function AboutPageClient() {
  const { t, locale } = useI18n();
  const router = useRouter();

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {/* ── Hero ── */}
      <section
        style={{
          minHeight: "100vh",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "0 0 80px",
        }}
      >
        {/* Subtle top-right ambient glow — matches screenshot */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 600,
            height: 500,
            background:
              "radial-gradient(ellipse at top right, rgba(217,174,59,0.13), transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="pt-24 lg:pt-36"
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 24px",
            paddingBottom: 0,
            width: "100%",
          }}
        >
          {/* Eyebrow */}
          <div className="epi-eyebrow" style={{ marginBottom: 28, color: "var(--epi-gold-500)" }}>
            {t("about.eyebrow")}
          </div>

          {/* Headline */}
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(64px, 11vw, 160px)",
              lineHeight: 0.9,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("about.headline1")}
            <br />
            <span style={{ color: "var(--epi-gold-400)" }}>{t("about.headlineAccent")}</span>
          </h1>

          {/* Script */}
          <p
            className="epi-script"
            style={{
              fontSize: "clamp(20px, 2.5vw, 30px)",
              color: "var(--epi-cream-100)",
              marginTop: 36,
              maxWidth: 660,
              lineHeight: 1.5,
              opacity: 0.75,
            }}
          >
            {t("about.script")}
          </p>
        </div>
      </section>

      {/* ── Story + Numbers ── */}
      <section style={{ padding: "80px 0 100px" }}>
        <div
          className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_420px] lg:gap-20"
          style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}
        >
          {/* Story text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {[t("about.p1"), t("about.p2"), t("about.p3")].map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 17,
                  lineHeight: 1.75,
                  color: "rgba(251,249,228,0.72)",
                  margin: 0,
                }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* Numbers card */}
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(217,174,59,0.18)",
              background: "linear-gradient(160deg, rgba(217,174,59,0.06), rgba(255,255,255,0.02))",
              padding: "32px 36px",
              position: "sticky",
              top: 100,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--epi-gold-500)",
                fontWeight: 700,
                marginBottom: 28,
              }}
            >
              {t("about.numbersLabel")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {STATS.map((s, i) => (
                <div key={s}>
                  {i > 0 && (
                    <div
                      style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" }}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 20,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(251,249,228,0.45)",
                      }}
                    >
                      {t(`about.${s}label` as Parameters<typeof t>[0])}
                    </span>
                    <span
                      className="epi-display"
                      style={{
                        fontSize: 32,
                        letterSpacing: "0.02em",
                        color: "var(--epi-cream-50)",
                        lineHeight: 1,
                      }}
                    >
                      {t(`about.${s}value` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 48px" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 48, color: "var(--epi-gold-500)" }}>
            {t("about.valuesEyebrow")}
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" style={{ gap: 28 }}>
            {VALUES.map((v, i) => (
              <div
                key={v}
                style={{
                  padding: "32px 28px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  className="epi-script"
                  aria-hidden="true"
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    color: "var(--epi-gold-500)",
                    opacity: 0.85,
                    marginBottom: 18,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--epi-cream-50)",
                    margin: "0 0 10px",
                  }}
                >
                  {t(`about.${v}title` as Parameters<typeof t>[0])}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "rgba(251,249,228,0.55)",
                    margin: 0,
                  }}
                >
                  {t(`about.${v}body` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20"
          style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}
        >
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 18, color: "var(--epi-gold-500)" }}>
              {t("about.teamEyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(36px, 4vw, 64px)",
                lineHeight: 0.95,
                margin: "0 0 20px",
                color: "var(--epi-cream-50)",
              }}
            >
              {t("about.teamTitle")}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(251,249,228,0.6)", margin: 0 }}>
              {t("about.teamBody")}
            </p>
            <a
              href={getLocalizedPath("/build-with-us", locale)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 20,
                fontSize: 14,
                color: "var(--epi-gold-400)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(217,174,59,0.4)",
              }}
            >
              {t("about.buildWithUs")} →
            </a>
          </div>

          {/* Avatar grid placeholder */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  borderRadius: 16,
                  background: `linear-gradient(135deg, rgba(217,174,59,${0.06 + i * 0.02}), rgba(255,255,255,0.03))`,
                  border: "1px solid rgba(255,255,255,0.07)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(217,174,59,0.35)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          padding: "100px 48px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
        }}
      >
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(48px, 7vw, 96px)",
            margin: "0 0 16px",
            color: "var(--epi-cream-50)",
            lineHeight: 0.95,
          }}
        >
          {t("about.ctaTitle")}
        </h2>
        <p style={{ fontSize: 17, color: "rgba(251,249,228,0.55)", marginBottom: 36 }}>
          {t("about.ctaBody")}
        </p>
        <button
          onClick={() => router.push("/register")}
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
          {t("about.ctaButton")}
        </button>
      </section>
    </div>
  );
}
