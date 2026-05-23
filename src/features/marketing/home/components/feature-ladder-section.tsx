"use client";

import React from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";
import { PhoneMenu } from "@/features/marketing/shared/components/phone-menu";
import { PhoneKDS } from "@/features/marketing/shared/components/phone-kds";

export function FeatureLadderSection() {
  const { t } = useI18n();
  const router = useRouter();

  const cardBase: React.CSSProperties = {
    position: "relative",
    padding: 32,
    borderRadius: 26,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    minHeight: 540,
  };

  return (
    <section className="epi-section">
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.coreProducts.eyebrow")}</div>
          <h2
            className="epi-display"
            style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
          >
            {t("redesign.coreProducts.title1")}<br />
            {t("redesign.coreProducts.title2")}
          </h2>
          <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, marginTop: 20, fontSize: 17, lineHeight: 1.55, maxWidth: 640, marginInline: "auto" }}>
            {t("redesign.coreProducts.sub")}
          </p>
        </div>

        {/* 3 module cards */}
        <div
          className="grid grid-cols-1 gap-4 mt-16 md:grid-cols-3"
        >
          {/* Card 1 — Menu Page */}
          <div style={{ ...cardBase, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(217,174,59,0.18)", border: "1px solid rgba(217,174,59,0.32)", display: "grid", placeItems: "center", color: "var(--epi-gold-300)", fontSize: 18 }}>⛓</div>
              <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--epi-gold-400)" }}>{t("redesign.coreProducts.p1tag")}</span>
            </div>
            <div>
              <div className="epi-display" style={{ fontSize: 32, letterSpacing: "0.04em", color: "var(--epi-cream-50)", lineHeight: 1 }}>
                {t("redesign.coreProducts.p1title1")}<br />{t("redesign.coreProducts.p1title2")}
              </div>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{t("redesign.coreProducts.p1body")}</p>
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 280 }}>
              <PhoneMenu />
            </div>
          </div>

          {/* Card 2 — Accept Orders */}
          <div style={{
            ...cardBase,
            background: "linear-gradient(160deg, rgba(217,174,59,0.16), rgba(217,174,59,0.02))",
            border: "1px solid rgba(217,174,59,0.40)",
          }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,174,59,0.20), transparent 60%)" }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(217,174,59,0.20)", border: "1px solid rgba(217,174,59,0.40)", display: "grid", placeItems: "center", color: "var(--epi-gold-300)", fontSize: 18 }}>💳</div>
              <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--epi-gold-300)" }}>{t("redesign.coreProducts.p2tag")}</span>
            </div>
            <div style={{ position: "relative" }}>
              <div className="epi-display" style={{ fontSize: 32, letterSpacing: "0.04em", color: "var(--epi-cream-50)", lineHeight: 1 }}>
                {t("redesign.coreProducts.p2title1")}<br />{t("redesign.coreProducts.p2title2")}
              </div>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{t("redesign.coreProducts.p2body")}</p>
            </div>
            <div style={{ position: "relative", flex: 1, padding: 18, borderRadius: 16, background: "rgba(6,15,27,0.5)", border: "1px solid rgba(245,244,220,0.10)", display: "flex", flexDirection: "column", gap: 10, minHeight: 280 }}>
              <div style={{ fontSize: 10, color: "var(--epi-cream-50)", opacity: 0.4, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t("redesign.coreProducts.p2checkoutLabel")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { n: "QRIS", c: "#0066B3" }, { n: "GoPay", c: "#00AED5" }, { n: "OVO", c: "#4C2A86" },
                  { n: "Card", c: "#1F4373" }, { n: "Bank", c: "#3A5B7A" }, { n: "Cash", c: "#5A4A2A" },
                ].map((p, i) => (
                  <div key={i} style={{ padding: "12px 10px", borderRadius: 10, background: `linear-gradient(140deg, ${p.c}, rgba(6,15,27,0.4))`, border: "1px solid rgba(245,244,220,0.10)", fontSize: 11, color: "var(--epi-cream-50)", textAlign: "center", fontWeight: 500 }}>{p.n}</div>
                ))}
              </div>
              <div style={{ marginTop: "auto", padding: "14px 16px", borderRadius: 12, background: "rgba(217,174,59,0.14)", border: "1px solid rgba(217,174,59,0.30)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--epi-gold-300)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{t("redesign.coreProducts.p2orderName")}</div>
                  <div style={{ fontSize: 14, color: "var(--epi-cream-50)", fontWeight: 600 }}>{t("redesign.coreProducts.p2orderVal")}</div>
                </div>
                <div style={{ padding: "6px 12px", borderRadius: 999, background: "#25D366", color: "white", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>→ WhatsApp</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.6, display: "flex", justifyContent: "space-between" }}>
                <span>{t("redesign.coreProducts.p2feeLabel")}</span>
                <span style={{ color: "var(--epi-gold-400)" }}>{t("redesign.coreProducts.p2settled")}</span>
              </div>
            </div>
          </div>

          {/* Card 3 — POS & Kitchen */}
          <div style={{ ...cardBase, background: "linear-gradient(180deg, rgba(91,136,178,0.10), rgba(91,136,178,0.02))", border: "1px solid rgba(91,136,178,0.30)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(91,136,178,0.20)", border: "1px solid rgba(91,136,178,0.40)", display: "grid", placeItems: "center", color: "var(--epi-navy-400)", fontSize: 18 }}>🍳</div>
              <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--epi-navy-400)" }}>{t("redesign.coreProducts.p3tag")}</span>
            </div>
            <div>
              <div className="epi-display" style={{ fontSize: 32, letterSpacing: "0.04em", color: "var(--epi-cream-50)", lineHeight: 1 }}>
                {t("redesign.coreProducts.p3title1")}<br />{t("redesign.coreProducts.p3title2")}
              </div>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{t("redesign.coreProducts.p3body")}</p>
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 280 }}>
              <PhoneKDS />
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 36 }}>
          <button
            onClick={() => router.push("/services")}
            className="cursor-pointer transition-all hover:-translate-y-px"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "var(--epi-cream-50)", padding: "14px 28px", borderRadius: 999, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)" }}
          >
            {t("redesign.coreProducts.fullFeatureList")}
          </button>
        </div>
      </div>
    </section>
  );
}
