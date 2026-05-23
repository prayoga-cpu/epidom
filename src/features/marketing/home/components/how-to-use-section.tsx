"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";

export function HowToUseSection() {
  const { t } = useI18n();
  const router = useRouter();

  const steps = [
    { n: t("redesign.setup.s1n"), title: t("redesign.setup.s1t"), body: t("redesign.setup.s1b") },
    { n: t("redesign.setup.s2n"), title: t("redesign.setup.s2t"), body: t("redesign.setup.s2b") },
    { n: t("redesign.setup.s3n"), title: t("redesign.setup.s3t"), body: t("redesign.setup.s3b") },
  ];

  return (
    <section className="epi-section epi-warm-section">
      <div className="epi-container">
        <div
          className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16 items-center"
        >
          {/* Left — copy */}
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 16, color: "var(--epi-gold-600)" }}>{t("redesign.setup.eyebrow")}</div>
            <h2
              className="epi-display"
              style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-navy-900)" }}
            >
              {t("redesign.setup.title1")}<br />
              {t("redesign.setup.title2")}<br />
              {t("redesign.setup.title3")}<br />
              <span style={{ color: "var(--epi-gold-600)" }}>{t("redesign.setup.titleAccent")}</span>
            </h2>
            <p style={{ color: "var(--epi-navy-700)", fontSize: 16, lineHeight: 1.6, marginTop: 22, maxWidth: 400 }}>
              {t("redesign.setup.sub")}
            </p>
            <button
              onClick={() => router.push("/register")}
              className="cursor-pointer transition-all hover:-translate-y-px active:translate-y-0"
              style={{ marginTop: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", height: 52, padding: "0 28px", borderRadius: 999, background: "var(--epi-gold-500)", color: "var(--epi-navy-900)", fontSize: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid transparent", fontFamily: "var(--epi-font-body)" }}
            >
              {t("redesign.setup.cta")}
            </button>
          </div>

          {/* Right — step rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{ padding: "24px 28px", borderRadius: 16, background: "rgba(255,255,255,0.60)", border: "1px solid rgba(6,15,27,0.08)", display: "grid", gridTemplateColumns: "70px 1fr", gap: 24, alignItems: "center" }}
              >
                <div className="epi-display" style={{ fontSize: 40, color: "var(--epi-gold-600)", letterSpacing: "0.04em", lineHeight: 1 }}>{s.n}</div>
                <div>
                  <div className="epi-display" style={{ fontSize: 22, letterSpacing: "0.04em", color: "var(--epi-navy-900)", marginBottom: 6 }}>{s.title}</div>
                  <div style={{ color: "var(--epi-navy-700)", fontSize: 14, lineHeight: 1.6 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
