"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function SocialProofSection() {
  const { t } = useI18n();

  const testimonials = [1, 2, 3, 4, 5, 6].map((n) => ({
    quote: t(`redesign.testimonials.t${n}q`),
    name: t(`redesign.testimonials.t${n}n`),
    role: t(`redesign.testimonials.t${n}r`),
    city: t(`redesign.testimonials.t${n}c`),
  }));

  // Duplicate for seamless loop
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="epi-section epi-warm-section overflow-hidden">
      <div className="epi-container">
        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 56 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16, color: "var(--epi-gold-600)" }}>{t("redesign.testimonials.eyebrow")}</div>
          <h2
            className="epi-display"
            style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-navy-900)" }}
          >
            {t("redesign.testimonials.title1")}<br />
            {t("redesign.testimonials.title2")}
          </h2>
        </div>
      </div>

      {/* Marquee track — bleeds outside epi-container intentionally */}
      <div className="relative">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-[var(--epi-cream-100)] to-transparent sm:w-24" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-[var(--epi-cream-100)] to-transparent sm:w-24" />

        <div
          className="flex gap-4 animate-marquee-half"
          style={{ width: "max-content" }}
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
        >
          {doubled.map((t2, i) => (
            <div
              key={i}
              style={{
                width: 300,
                flexShrink: 0,
                padding: 24,
                borderRadius: 22,
                background: i % 6 === 1 || i % 6 === 4 ? "rgba(217,174,59,0.08)" : "rgba(255,255,255,0.55)",
                border: "1px solid",
                borderColor: i % 6 === 1 || i % 6 === 4 ? "rgba(217,174,59,0.28)" : "rgba(6,15,27,0.08)",
                display: "flex", flexDirection: "column", gap: 20,
              }}
            >
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} width="14" height="14" viewBox="0 0 16 16" fill="var(--epi-gold-500)">
                    <path d="M8 1l2.2 4.5L15 6.3l-3.5 3.4.8 4.8L8 12.2 3.7 14.5l.8-4.8L1 6.3l4.8-.8z" />
                  </svg>
                ))}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--epi-navy-900)", flex: 1, margin: 0 }}>
                &ldquo;{t2.quote}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid rgba(6,15,27,0.08)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(140deg, var(--epi-navy-500), var(--epi-navy-700))", display: "grid", placeItems: "center", color: "var(--epi-gold-400)", fontFamily: "var(--epi-font-display)", fontSize: 14, letterSpacing: "0.06em" }}>
                  {t2.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--epi-navy-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t2.name}</div>
                  <div style={{ fontSize: 11, color: "var(--epi-navy-700)", opacity: 0.7 }}>{t2.role} · {t2.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
