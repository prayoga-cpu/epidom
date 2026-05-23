"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

export function FaqSection() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number>(0);

  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`redesign.faq.q${n}` as const),
    a: t(`redesign.faq.a${n}` as const),
  }));

  return (
    <section className="epi-section">
      <div className="epi-container">
        <div
          className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20 items-start"
        >
          {/* Left — sticky heading */}
          <div className="lg:sticky lg:top-28">
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.faq.eyebrow")}</div>
            <h2
              className="epi-display"
              style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
            >
              {t("redesign.faq.title")}
            </h2>
            <p className="epi-script" style={{ fontSize: 22, color: "var(--epi-gold-300)", marginTop: 18, lineHeight: 1.3, display: "block" }}>
              {t("redesign.faq.script")}
            </p>
            <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 15, lineHeight: 1.55, marginTop: 20 }}>
              {t("redesign.faq.helpText")}{" "}
              <span style={{ color: "#25D366", borderBottom: "1px solid #25D366", cursor: "pointer" }} onClick={() => window.open("https://wa.me/6281234567890", "_blank")}>
                {t("redesign.faq.helpWa")}
              </span>
              {" "}{t("redesign.faq.helpOr")}{" "}
              <a href={`mailto:${t("redesign.faq.helpEmail")}`} style={{ color: "var(--epi-gold-400)", borderBottom: "1px solid var(--epi-gold-500)" }}>
                {t("redesign.faq.helpEmail")}
              </a>.
            </p>
          </div>

          {/* Right — accordion */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0", gap: 24 }}>
                  <div
                    className="epi-display"
                    style={{ fontSize: 22, letterSpacing: "0.04em", color: open === i ? "var(--epi-cream-50)" : "rgba(251,249,228,0.5)", transition: "color 0.2s" }}
                  >
                    {faq.q}
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", display: "grid", placeItems: "center", color: open === i ? "var(--epi-gold-400)" : "rgba(251,249,228,0.4)", transition: "transform 0.2s, color 0.2s", transform: open === i ? "rotate(45deg)" : "rotate(0)", flexShrink: 0, fontSize: 20 }}>+</div>
                </div>
                <div style={{ maxHeight: open === i ? 240 : 0, overflow: "hidden", transition: "max-height 0.3s ease, padding 0.2s", paddingBottom: open === i ? 24 : 0 }}>
                  <p style={{ color: "var(--epi-cream-50)", opacity: 0.65, fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 580 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
