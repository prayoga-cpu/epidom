"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";

const STATS = ["stat1", "stat2", "stat3", "stat4"] as const;
const VALUES = ["v1", "v2", "v3"] as const;

export function AboutPageClient() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>

      {/* ── Hero ── */}
      <section style={{ minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 0 80px" }}>
        {/* Subtle top-right ambient glow — matches screenshot */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 600, height: 500,
          background: "radial-gradient(ellipse at top right, rgba(217,174,59,0.13), transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "140px 48px 0", width: "100%" }}>
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
        <div style={{
          maxWidth: 1120, margin: "0 auto", padding: "0 48px",
          display: "grid", gridTemplateColumns: "1fr 420px", gap: 80, alignItems: "start",
        }} className="grid-cols-1! lg:grid-cols-[1fr_420px]!">

          {/* Story text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {[t("about.p1"), t("about.p2"), t("about.p3")].map((para, i) => (
              <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: "rgba(251,249,228,0.72)", margin: 0 }}>
                {para}
              </p>
            ))}
          </div>

          {/* Numbers card */}
          <div style={{
            borderRadius: 20,
            border: "1px solid rgba(217,174,59,0.18)",
            background: "linear-gradient(160deg, rgba(217,174,59,0.06), rgba(255,255,255,0.02))",
            padding: "32px 36px",
            position: "sticky",
            top: 100,
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
              color: "var(--epi-gold-500)", fontWeight: 700, marginBottom: 28,
            }}>
              {t("about.numbersLabel")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {STATS.map((s, i) => (
                <div key={s}>
                  {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" }} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                    <span style={{
                      fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "rgba(251,249,228,0.45)",
                    }}>
                      {t(`about.${s}label` as Parameters<typeof t>[0])}
                    </span>
                    <span className="epi-display" style={{ fontSize: 32, letterSpacing: "0.02em", color: "var(--epi-cream-50)", lineHeight: 1 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }} className="grid-cols-1! sm:grid-cols-3!">
            {VALUES.map((v) => (
              <div
                key={v}
                style={{
                  padding: "32px 28px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, marginBottom: 20,
                  background: "rgba(217,174,59,0.12)", border: "1px solid rgba(217,174,59,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {v === "v1" && <LeafIcon />}
                  {v === "v2" && <WrenchIcon />}
                  {v === "v3" && <ShieldIcon />}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--epi-cream-50)", margin: "0 0 10px" }}>
                  {t(`about.${v}title` as Parameters<typeof t>[0])}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(251,249,228,0.55)", margin: 0 }}>
                  {t(`about.${v}body` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="grid-cols-1! lg:grid-cols-2!">
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 18, color: "var(--epi-gold-500)" }}>
              {t("about.teamEyebrow")}
            </div>
            <h2 className="epi-display" style={{ fontSize: "clamp(36px, 4vw, 64px)", lineHeight: 0.95, margin: "0 0 20px", color: "var(--epi-cream-50)" }}>
              {t("about.teamTitle")}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(251,249,228,0.6)", margin: 0 }}>
              {t("about.teamBody")}
            </p>
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(217,174,59,0.35)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "100px 48px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
      }}>
        <h2 className="epi-display" style={{ fontSize: "clamp(48px, 7vw, 96px)", margin: "0 0 16px", color: "var(--epi-cream-50)", lineHeight: 0.95 }}>
          {t("about.ctaTitle")}
        </h2>
        <p style={{ fontSize: 17, color: "rgba(251,249,228,0.55)", marginBottom: 36 }}>
          {t("about.ctaBody")}
        </p>
        <button
          onClick={() => router.push("/register")}
          className="cursor-pointer transition-all hover:-translate-y-px"
          style={{
            padding: "16px 36px", borderRadius: 999, border: "none",
            background: "var(--epi-gold-500)", color: "var(--epi-navy-900)",
            fontSize: 15, fontWeight: 700, letterSpacing: "0.06em",
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

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--epi-gold-400)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0118 6.16C14.63 5.4 11 5.35 7 8c-4 2.67-5 8-3 13" /><path d="M11 20c0-3.86 1.29-7 5-10" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--epi-gold-400)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--epi-gold-400)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
