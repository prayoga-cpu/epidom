"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";

export function PricingSection() {
  const { t } = useI18n();
  const router = useRouter();

  const tiers = [
    { tag: t("redesign.pricingTeaser.t1tag"), name: t("redesign.pricingTeaser.t1name"), price: t("redesign.pricingTeaser.t1price"), period: t("redesign.pricingTeaser.t1period"), desc: t("redesign.pricingTeaser.t1desc"), highlight: false },
    { tag: t("redesign.pricingTeaser.t2tag"), name: t("redesign.pricingTeaser.t2name"), price: t("redesign.pricingTeaser.t2price"), period: t("redesign.pricingTeaser.t2period"), desc: t("redesign.pricingTeaser.t2desc"), highlight: false },
    { tag: t("redesign.pricingTeaser.t3tag"), name: t("redesign.pricingTeaser.t3name"), price: t("redesign.pricingTeaser.t3price"), period: t("redesign.pricingTeaser.t3period"), desc: t("redesign.pricingTeaser.t3desc"), highlight: true },
    { tag: t("redesign.pricingTeaser.t4tag"), name: t("redesign.pricingTeaser.t4name"), price: t("redesign.pricingTeaser.t4price"), period: t("redesign.pricingTeaser.t4period"), desc: t("redesign.pricingTeaser.t4desc"), highlight: false },
  ];

  return (
    <section className="epi-section" style={{ background: "linear-gradient(180deg, transparent, rgba(11,26,40,0.5))" }}>
      <div className="epi-container">
        {/* Heading */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginBottom: 56, flexWrap: "wrap" }}>
          <div>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.pricingTeaser.eyebrow")}</div>
            <h2
              className="epi-display"
              style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
            >
              {t("redesign.pricingTeaser.title1")}<br />
              {t("redesign.pricingTeaser.title2")}
            </h2>
            <p style={{ color: "var(--epi-cream-50)", opacity: 0.72, marginTop: 16, fontSize: 16, lineHeight: 1.55, maxWidth: 480 }}>
              {t("redesign.pricingTeaser.sub")}
            </p>
          </div>
          <button
            onClick={() => router.push("/pricing")}
            className="cursor-pointer transition-all hover:-translate-y-px"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "var(--epi-cream-50)", padding: "12px 24px", borderRadius: 999, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)", whiteSpace: "nowrap" }}
          >
            {t("redesign.pricingTeaser.fullComparison")}
          </button>
        </div>

        {/* Tier cards */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {tiers.map((tier, i) => (
            <div
              key={i}
              onClick={() => router.push("/pricing")}
              className="cursor-pointer transition-all hover:-translate-y-1"
              style={{
                padding: "22px 20px",
                borderRadius: 22,
                background: tier.highlight
                  ? "linear-gradient(160deg, rgba(217,174,59,0.18), rgba(217,174,59,0.04))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid",
                borderColor: tier.highlight ? "rgba(217,174,59,0.45)" : "rgba(255,255,255,0.08)",
                position: "relative",
                display: "flex", flexDirection: "column", gap: 16,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: tier.highlight ? "var(--epi-gold-300)" : "var(--epi-cream-50)", opacity: tier.highlight ? 1 : 0.4 }}>
                {tier.tag}
              </div>
              <div className="epi-display" style={{ fontSize: 32, letterSpacing: "0.04em", color: "var(--epi-cream-50)" }}>
                {tier.name}
              </div>
              <div>
                <div className="epi-display" style={{ fontSize: 40, color: "var(--epi-cream-50)", letterSpacing: "0.01em", lineHeight: 1 }}>
                  {tier.price}
                </div>
                <div style={{ color: "var(--epi-cream-50)", opacity: 0.5, fontSize: 12, marginTop: 4, letterSpacing: "0.04em" }}>
                  {tier.period}
                </div>
              </div>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                {tier.desc}
              </p>
              <div style={{ marginTop: "auto", color: tier.highlight ? "var(--epi-gold-400)" : "var(--epi-cream-50)", fontSize: 12, letterSpacing: "0.08em" }}>
                {t("redesign.pricingTeaser.seeplan")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
