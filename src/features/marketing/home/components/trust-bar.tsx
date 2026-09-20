"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  TRUSTED_BRANDS,
  getConsentedBrands,
  type TrustedBrand,
} from "@/features/marketing/home/data/trusted-brands";

// Payment and messaging channels the product really talks to (see
// src/lib/payments and the WhatsApp ordering links). Shown as plain text
// wordmarks on purpose: no third-party logos, no implied partnership.
const WORKS_WITH = ["Stripe", "Xendit", "QRIS", "WhatsApp"] as const;

export function TrustBar({ brands = TRUSTED_BRANDS }: { brands?: readonly TrustedBrand[] }) {
  const { t } = useI18n();
  // Customer logos only ever render for brands that confirmed in writing.
  const customers = getConsentedBrands(brands);
  const markets = [
    { key: "fr", flag: "🇫🇷", label: t("redesign.trust.marketFr") },
    { key: "id", flag: "🇮🇩", label: t("redesign.trust.marketId") },
    { key: "world", flag: "🌍", label: t("redesign.trust.marketWorld") },
  ];

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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {markets.map((m) => (
                <span
                  key={m.key}
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

          <ul
            aria-label={t("redesign.trust.label")}
            className="m-0 mt-6 flex list-none flex-wrap items-baseline gap-x-10 gap-y-3 p-0 px-7"
          >
            {WORKS_WITH.map((name) => (
              <li
                key={name}
                className="epi-script text-2xl whitespace-nowrap text-[var(--epi-cream-50)] opacity-75"
              >
                {name}
              </li>
            ))}
          </ul>

          {customers.length > 0 && (
            <div
              data-testid="trusted-brands"
              className="mt-6 border-t border-white/[0.07] px-7 pt-6"
            >
              <p className="m-0 text-xs tracking-[0.18em] text-[var(--epi-cream-50)] uppercase opacity-50">
                {t("redesign.trust.customersLabel")}
              </p>
              <ul className="m-0 mt-4 flex list-none flex-wrap items-center gap-5 p-0">
                {customers.map((brand) => (
                  <li key={brand.slug}>
                    {/* One shared circular crop so marks of different shapes and
                        backgrounds read as a set; the white disc keeps dark
                        marks legible on the navy card. */}
                    <span className="relative block size-14 overflow-hidden rounded-full bg-white ring-1 ring-white/25">
                      <Image
                        src={brand.logo}
                        alt={brand.name}
                        width={56}
                        height={56}
                        sizes="56px"
                        className="size-full object-cover"
                        style={brand.zoom ? { transform: `scale(${brand.zoom})` } : undefined}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
