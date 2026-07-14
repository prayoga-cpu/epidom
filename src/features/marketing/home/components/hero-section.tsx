"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { PosDashboard } from "@/features/marketing/shared/components/pos-dashboard";
import { PhoneMenu } from "@/features/marketing/shared/components/phone-menu";
import { trackEvent } from "@/lib/analytics";

export function HeroSection() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section
      style={{
        position: "relative",
        paddingTop: 140,
        paddingBottom: 100,
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          top: -300,
          right: -200,
          background: "radial-gradient(circle, rgba(217,174,59,0.22), transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          top: 100,
          left: -200,
          background: "radial-gradient(circle, rgba(91,136,178,0.18), transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div className="epi-hero-pattern" />

      <div className="epi-container">
        <div className="relative z-10 grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* Left — copy */}
          <div>
            <div className="epi-pill">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--epi-gold-500)",
                  boxShadow: "0 0 12px var(--epi-gold-500)",
                  flexShrink: 0,
                }}
              />
              {t("redesign.hero.badge")}
            </div>

            <h1
              className="epi-display"
              style={{
                fontSize: "clamp(56px, 8vw, 124px)",
                lineHeight: 0.88,
                margin: "24px 0 0",
                color: "var(--epi-cream-50)",
              }}
            >
              {t("redesign.hero.headline1")}
              <br />
              {t("redesign.hero.headline2")}
              <br />
              <span style={{ color: "var(--epi-gold-400)" }}>
                {t("redesign.hero.headlineAccent")}
              </span>
              <span
                className="epi-script"
                style={{
                  color: "var(--epi-gold-300)",
                  textTransform: "lowercase",
                  fontSize: "0.32em",
                  display: "block",
                  lineHeight: 1.1,
                  marginTop: 8,
                }}
              >
                {t("redesign.hero.serifAccent")}
              </span>
            </h1>

            <p
              style={{
                color: "var(--epi-cream-50)",
                opacity: 0.72,
                fontSize: "clamp(15px, 1.4vw, 18px)",
                lineHeight: 1.6,
                maxWidth: 580,
                marginTop: 28,
                fontFamily: "var(--epi-font-body)",
              }}
            >
              {t("redesign.hero.lede")}
            </p>

            <div className="flex flex-col flex-wrap sm:flex-row" style={{ gap: 14, marginTop: 36 }}>
              <button
                onClick={() => {
                  trackEvent("cta_click", {
                    event_category: "engagement",
                    event_label: "hero_start_free",
                  });
                  router.push("/register");
                }}
                className="cursor-pointer transition-all hover:-translate-y-px active:translate-y-0"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 56,
                  padding: "0 30px",
                  borderRadius: 999,
                  background: "var(--epi-gold-500)",
                  color: "var(--epi-navy-900)",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  border: "1px solid transparent",
                  boxShadow: "0 8px 24px -10px rgba(217,174,59,0.6)",
                  fontFamily: "var(--epi-font-body)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("redesign.hero.ctaPrimary")}
              </button>
              <button
                onClick={() => {
                  trackEvent("cta_click", {
                    event_category: "engagement",
                    event_label: "hero_see_product",
                  });
                  router.push("/services");
                }}
                className="cursor-pointer transition-all hover:-translate-y-px"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 56,
                  padding: "0 30px",
                  borderRadius: 999,
                  background: "transparent",
                  color: "var(--epi-cream-50)",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontFamily: "var(--epi-font-body)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("redesign.hero.ctaSecondary")}
              </button>
            </div>

            {/* Proof stats */}
            <div
              style={{
                display: "flex",
                gap: 36,
                marginTop: 44,
                paddingTop: 28,
                borderTop: "1px solid rgba(255,255,255,0.10)",
                flexWrap: "wrap",
              }}
            >
              {[
                { v: t("redesign.hero.proof1Val"), l: t("redesign.hero.proof1Label") },
                { v: t("redesign.hero.proof2Val"), l: t("redesign.hero.proof2Label") },
                { v: t("redesign.hero.proof3Val"), l: t("redesign.hero.proof3Label") },
                { v: t("redesign.hero.proof4Val"), l: t("redesign.hero.proof4Label") },
              ].map((p, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    className="epi-display"
                    style={{ fontSize: 36, color: "var(--epi-cream-50)", letterSpacing: "0.02em" }}
                  >
                    {p.v}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--epi-cream-50)",
                      opacity: 0.5,
                    }}
                  >
                    {p.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — mockups */}
          <div className="hidden lg:block" style={{ position: "relative", minHeight: 540 }}>
            <div
              style={{
                position: "absolute",
                inset: -30,
                background: "radial-gradient(circle, rgba(91,136,178,0.18), transparent 70%)",
                filter: "blur(40px)",
                zIndex: -1,
              }}
            />
            {/* Dashboard behind */}
            <div
              className="epi-float-dash"
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                width: "95%",
                transformOrigin: "top right",
              }}
            >
              <PosDashboard />
            </div>
            {/* Phone overlapping */}
            <div
              className="epi-float-phone"
              style={{ position: "absolute", left: -10, bottom: 0, width: 240, zIndex: 2 }}
            >
              <PhoneMenu />
            </div>
            {/* Floating notification chip — dark glass */}
            <div
              className="epi-float-chip"
              style={{
                position: "absolute",
                right: -10,
                top: -10,
                padding: "11px 16px",
                borderRadius: 14,
                background: "rgba(6,15,27,0.82)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.11)",
                boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                zIndex: 3,
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontFamily: "var(--epi-font-body)",
                color: "var(--epi-cream-50)",
              }}
            >
              {/* Pulsing live dot */}
              <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 6px rgba(34,197,94,0.7)",
                  }}
                />
              </span>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(251,249,228,0.45)",
                    marginBottom: 2,
                  }}
                >
                  {t("redesign.hero.waChip")}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--epi-cream-50)" }}>
                  {t("redesign.hero.waDetail")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
