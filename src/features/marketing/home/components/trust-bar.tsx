"use client";

import { motion } from "motion/react";
import { useI18n } from "@/components/lang/i18n-provider";

const shops = [
  { name: "Warung Sari", flag: "🇮🇩" },
  { name: "Café Bretonne", flag: "🇫🇷" },
  { name: "Maison Lacroix", flag: "🇫🇷" },
  { name: "Kopi Tujuh", flag: "🇮🇩" },
  { name: "Cookie Atelier", flag: "🇫🇷" },
  { name: "Le Petit Bar", flag: "🇫🇷" },
];

const MARKETS = [
  { flag: "🇫🇷", label: "France" },
  { flag: "🇮🇩", label: "Indonesia" },
  { flag: "🌍", label: "Worldwide" },
];

function MarqueeRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden} style={{ gap: 56 }}>
      {shops.map((s, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 10,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 15, opacity: 0.7 }}>{s.flag}</span>
          <span
            className="epi-script"
            style={{
              color: "var(--epi-cream-50)",
              opacity: 0.75,
              fontSize: 24,
              letterSpacing: "0.01em",
            }}
          >
            {s.name}
          </span>
        </span>
      ))}
    </div>
  );
}

export function TrustBar() {
  const { t } = useI18n();

  return (
    <section style={{ padding: "48px 0" }}>
      <div className="epi-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          style={{
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
            padding: "28px 0 32px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              padding: "0 28px 22px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--epi-cream-50)",
                opacity: 0.5,
                fontFamily: "var(--epi-font-body)",
              }}
            >
              {t("redesign.trust.label")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {MARKETS.map((m) => (
                <span
                  key={m.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(217,174,59,0.22)",
                    background: "rgba(217,174,59,0.06)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--epi-gold-300)",
                    fontFamily: "var(--epi-font-body)",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{m.flag}</span>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Marquee — track duplicated once, animated -50% for a seamless loop */}
          <div
            className="group relative mt-6"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div
              className="animate-marquee-half flex group-hover:[animation-play-state:paused]"
              style={{ gap: 56, width: "max-content" }}
            >
              <MarqueeRow />
              <MarqueeRow ariaHidden />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
