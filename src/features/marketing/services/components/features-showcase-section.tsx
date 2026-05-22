"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PhoneMenu } from "@/features/marketing/shared/components/phone-menu";
import { PhoneKDS } from "@/features/marketing/shared/components/phone-kds";

function OrderVisual({ t }: { t: (k: string) => string }) {
  return (
    <div style={{ padding: 28, borderRadius: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="epi-eyebrow" style={{ marginBottom: 14, color: "rgba(251,249,228,0.4)" }}>{t("redesign.servicesPage.checkoutSim")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[{ n: "QRIS", c: "#0066B3" }, { n: "GoPay", c: "#00AED5" }, { n: "OVO", c: "#4C2A86" }, { n: "Card", c: "#1F4373" }, { n: "Bank", c: "#3A5B7A" }, { n: "Cash", c: "#5A4A2A" }].map((p, i) => (
          <div key={i} style={{ padding: "20px 14px", borderRadius: 12, background: `linear-gradient(140deg, ${p.c}, rgba(6,15,27,0.4))`, border: "1px solid rgba(245,244,220,0.10)", fontSize: 13, color: "var(--epi-cream-50)", textAlign: "center", fontWeight: 500 }}>{p.n}</div>
        ))}
      </div>
      <div style={{ marginTop: 18, padding: "16px 18px", borderRadius: 12, background: "rgba(217,174,59,0.14)", border: "1px solid rgba(217,174,59,0.30)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--epi-gold-300)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Maya · order #1041</div>
          <div style={{ fontSize: 16, color: "var(--epi-cream-50)", fontWeight: 600 }}>Rp 56,000 · paid via QRIS</div>
        </div>
        <div style={{ padding: "8px 14px", borderRadius: 999, background: "#25D366", color: "white", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>→ WhatsApp ✓</div>
      </div>
      <div style={{ marginTop: 8, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", fontSize: 13, color: "var(--epi-cream-50)", opacity: 0.6, display: "flex", justifyContent: "space-between" }}>
        <span>Settled to your bank · next business day</span>
        <span style={{ color: "var(--epi-gold-400)" }}>−0.7% fee</span>
      </div>
    </div>
  );
}

function RecipeVisual({ t }: { t: (k: string) => string }) {
  return (
    <div style={{ padding: 28, borderRadius: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div className="epi-eyebrow" style={{ color: "rgba(251,249,228,0.4)" }}>Recipe</div>
          <div className="epi-display" style={{ fontSize: 28, letterSpacing: "0.04em", color: "var(--epi-cream-50)", marginTop: 6 }}>{t("redesign.servicesPage.recipeName")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="epi-display" style={{ fontSize: 36, color: "var(--epi-gold-400)", letterSpacing: "0.02em", lineHeight: 1 }}>Rp 6.2k</div>
          <div style={{ fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("redesign.servicesPage.recipeCost")}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[{ i: "Flour", q: "54 g", c: "Rp 0.7k" }, { i: "Butter", q: "32 g", c: "Rp 2.1k" }, { i: "Brown sugar", q: "28 g", c: "Rp 0.4k" }, { i: "Dark choc 70%", q: "20 g", c: "Rp 1.8k" }, { i: "Egg", q: "0.5", c: "Rp 0.8k" }, { i: "Packaging", q: "1", c: "Rp 0.4k" }].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: i < 5 ? "1px dashed rgba(255,255,255,0.06)" : "none" }}>
            <span style={{ color: "var(--epi-cream-50)" }}>{r.i}</span>
            <span style={{ color: "var(--epi-cream-50)", opacity: 0.5 }}>{r.q}</span>
            <span style={{ color: "var(--epi-gold-400)", fontVariantNumeric: "tabular-nums" }}>{r.c}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: "rgba(217,174,59,0.08)", border: "1px solid rgba(217,174,59,0.24)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <span style={{ color: "var(--epi-gold-300)" }}>{t("redesign.servicesPage.recipeMargin")}</span>
        <span className="epi-display" style={{ fontSize: 18, letterSpacing: "0.06em", color: "var(--epi-gold-300)" }}>+Rp 11.8k</span>
      </div>
    </div>
  );
}

function ReportVisual({ t }: { t: (k: string) => string }) {
  return (
    <div style={{ padding: 28, borderRadius: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="epi-eyebrow" style={{ color: "rgba(251,249,228,0.4)" }}>{t("redesign.servicesPage.plLabel")}</div>
          <div className="epi-display" style={{ fontSize: 26, letterSpacing: "0.04em", color: "var(--epi-cream-50)", marginTop: 6 }}>{t("redesign.servicesPage.plMargin")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="epi-display" style={{ fontSize: 32, color: "var(--epi-gold-400)", lineHeight: 1 }}>+4.8%</div>
          <div style={{ fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.4 }}>{t("redesign.servicesPage.plVs")}</div>
        </div>
      </div>
      {[
        ["Revenue", "Rp 124.5M", true],
        ["COGS", "Rp 42.1M", false],
        ["Staff cost", "Rp 28.8M", false],
        ["Net profit", "Rp 42.6M", true],
      ].map(([label, val, gold], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
          <span style={{ color: "var(--epi-cream-50)", opacity: 0.7 }}>{label as string}</span>
          <span style={{ color: gold ? "var(--epi-gold-400)" : "var(--epi-cream-50)", fontVariantNumeric: "tabular-nums" }}>{val as string}</span>
        </div>
      ))}
      <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", fontSize: 12, color: "var(--epi-cream-50)", opacity: 0.4 }}>
        {t("redesign.servicesPage.plSettled")}
      </div>
    </div>
  );
}

const FEATURE_ROWS = [
  { key: "r1", side: "menu" },
  { key: "r2", side: "order" },
  { key: "r3", side: "pos" },
  { key: "r4", side: "recipe" },
  { key: "r5", side: "report" },
] as const;

const INTEGRATIONS = ["QRIS", "GoPay", "OVO", "Stripe", "SumUp", "WhatsApp", "Brother", "Dymo", "Google Sheets", "QuickBooks"];

export function FeaturesShowcaseSection() {
  const { t } = useI18n();

  function getVisual(side: string) {
    if (side === "menu") return <div style={{ display: "grid", placeItems: "center" }}><PhoneMenu /></div>;
    if (side === "order") return <OrderVisual t={t} />;
    if (side === "pos") return <div style={{ display: "grid", placeItems: "center" }}><PhoneKDS /></div>;
    if (side === "recipe") return <RecipeVisual t={t} />;
    if (side === "report") return <ReportVisual t={t} />;
    return null;
  }

  return (
    <>
      {/* Feature rows */}
      <section className="epi-section epi-section--tight">
        <div className="epi-container">
          {FEATURE_ROWS.map(({ key, side }, i) => (
            <div
              key={key}
              className="grid grid-cols-1 lg:grid-cols-2"
              style={{ gap: 64, alignItems: "center", padding: "64px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
            >
              <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                <div className="epi-eyebrow" style={{ marginBottom: 14 }}>{t(`redesign.servicesPage.${key}eyebrow` as const)}</div>
                <h3
                  className="epi-display"
                  style={{ fontSize: "clamp(32px, 4vw, 56px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
                >
                  {t(`redesign.servicesPage.${key}title` as const)}
                </h3>
                <p style={{ color: "var(--epi-cream-50)", opacity: 0.65, fontSize: 16, lineHeight: 1.6, marginTop: 20 }}>
                  {t(`redesign.servicesPage.${key}body` as const)}
                </p>
                <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--epi-cream-50)", fontSize: 14 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" fill="rgba(217,174,59,0.16)" />
                        <path d="M5 8l2 2 4-4" stroke="var(--epi-gold-400)" strokeWidth="1.6" fill="none" />
                      </svg>
                      {t(`redesign.servicesPage.${key}b${n}` as const)}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ order: i % 2 === 0 ? 2 : 1 }}>
                {getVisual(side)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="epi-section">
        <div className="epi-container">
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 48 }}>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.servicesPage.intEyebrow")}</div>
            <h2
              className="epi-display"
              style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
            >
              {t("redesign.servicesPage.intTitle1")}<br />
              {t("redesign.servicesPage.intTitle2")}
            </h2>
          </div>
          <div
            className="grid grid-cols-2 sm:grid-cols-5"
            style={{ gap: 14 }}
          >
            {INTEGRATIONS.map((name, i) => (
              <div
                key={i}
                style={{ padding: "20px 16px", borderRadius: 14, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", fontFamily: "var(--epi-font-display)", fontSize: 18, letterSpacing: "0.06em", color: "var(--epi-cream-50)" }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
