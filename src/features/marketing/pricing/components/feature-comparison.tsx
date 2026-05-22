"use client";

import { Fragment } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

const CATEGORIES = [
  {
    labelKey: "redesign.pricingPage.cmpCat1",
    rows: [
      { labelKey: "redesign.pricingPage.cmp_menu_items", free: true, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_qr", free: true, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_branding", free: true, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_multilingual", free: true, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_wa", free: true, pos: true, ops: true, ent: true },
    ],
  },
  {
    labelKey: "redesign.pricingPage.cmpCat2",
    rows: [
      { labelKey: "redesign.pricingPage.cmp_qris", free: true, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_gopay", free: false, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_fee", free: true, pos: true, ops: true, ent: true },
    ],
  },
  {
    labelKey: "redesign.pricingPage.cmpCat3",
    rows: [
      { labelKey: "redesign.pricingPage.cmp_phone_pos", free: false, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_kds", free: false, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_thermal", free: false, pos: true, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_staff", free: false, pos: false, ops: true, ent: true },
    ],
  },
  {
    labelKey: "redesign.pricingPage.cmpCat4",
    rows: [
      { labelKey: "redesign.pricingPage.cmp_recipes", free: false, pos: false, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_stock", free: false, pos: false, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_daily", free: false, pos: false, ops: true, ent: true },
      { labelKey: "redesign.pricingPage.cmp_multi", free: false, pos: false, ops: false, ent: true },
      { labelKey: "redesign.pricingPage.cmp_api", free: false, pos: false, ops: false, ent: true },
    ],
  },
] as const;

const TIER_KEYS = [
  { key: "t1name", highlight: false },
  { key: "t2name", highlight: false },
  { key: "t3name", highlight: true },
  { key: "t4name", highlight: false },
] as const;

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ margin: "0 auto", display: "block" }} fill="none" aria-label="Included">
      <circle cx="9" cy="9" r="8.5" fill="rgba(217,174,59,0.14)" stroke="rgba(217,174,59,0.28)" strokeWidth="0.5" />
      <path d="M5.5 9.2l2.3 2.3 4.7-5" stroke="var(--epi-gold-400)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ margin: "0 auto", display: "block" }} fill="none" aria-label="Not included">
      <circle cx="9" cy="9" r="8.5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      <path d="M6 9h6" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function FeatureComparison() {
  const { t } = useI18n();

  return (
    <section className="epi-section" style={{ paddingTop: 40 }}>
      <div className="epi-container">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 64 }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.pricingPage.cmpEyebrow")}
          </div>
          <h2
            className="epi-display"
            style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, lineHeight: 0.95, color: "var(--epi-cream-50)" }}
          >
            {t("redesign.pricingPage.cmpTitle")}
          </h2>
          <p style={{ color: "var(--epi-cream-100)", opacity: 0.65, marginTop: 18, fontSize: 16, lineHeight: 1.6 }}>
            {t("redesign.pricingPage.cmpSub")}
          </p>
        </div>

        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "38%" }} />
              <col style={{ width: "15.5%" }} />
              <col style={{ width: "15.5%" }} />
              <col style={{ width: "15.5%" }} />
              <col style={{ width: "15.5%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                <th
                  style={{
                    padding: "14px 20px",
                    textAlign: "left",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(251,249,228,0.35)",
                    fontFamily: "var(--epi-font-body)",
                    fontWeight: 600,
                  }}
                >
                  Feature
                </th>
                {TIER_KEYS.map(({ key, highlight }) => (
                  <th
                    key={key}
                    style={{
                      padding: "14px 12px",
                      textAlign: "center",
                      fontFamily: "var(--epi-font-display)",
                      fontSize: 20,
                      letterSpacing: "0.04em",
                      color: highlight ? "var(--epi-gold-400)" : "var(--epi-cream-50)",
                      opacity: highlight ? 1 : 0.65,
                      background: highlight ? "rgba(217,174,59,0.05)" : "transparent",
                      borderLeft: highlight ? "1px solid rgba(217,174,59,0.14)" : undefined,
                      borderRight: highlight ? "1px solid rgba(217,174,59,0.14)" : undefined,
                    }}
                  >
                    {t(`redesign.pricingPage.${key}` as Parameters<typeof t>[0])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat, ci) => (
                <Fragment key={`cat-${ci}`}>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "24px 20px 10px",
                        fontSize: 10,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "var(--epi-gold-500)",
                        fontFamily: "var(--epi-font-body)",
                        fontWeight: 700,
                      }}
                    >
                      {t(cat.labelKey as Parameters<typeof t>[0])}
                    </td>
                  </tr>
                  {cat.rows.map((row, ri) => (
                    <tr key={`${ci}-${ri}`} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{
                        padding: "13px 20px",
                        fontSize: 14,
                        color: "var(--epi-cream-100)",
                        opacity: 0.78,
                        fontFamily: "var(--epi-font-body)",
                      }}>
                        {t(row.labelKey as Parameters<typeof t>[0])}
                      </td>
                      <td style={{ padding: "13px 12px", textAlign: "center" }}>
                        {row.free ? <CheckIcon /> : <DashIcon />}
                      </td>
                      <td style={{ padding: "13px 12px", textAlign: "center" }}>
                        {row.pos ? <CheckIcon /> : <DashIcon />}
                      </td>
                      <td style={{
                        padding: "13px 12px",
                        textAlign: "center",
                        background: "rgba(217,174,59,0.04)",
                        borderLeft: "1px solid rgba(217,174,59,0.12)",
                        borderRight: "1px solid rgba(217,174,59,0.12)",
                      }}>
                        {row.ops ? <CheckIcon /> : <DashIcon />}
                      </td>
                      <td style={{ padding: "13px 12px", textAlign: "center" }}>
                        {row.ent ? <CheckIcon /> : <DashIcon />}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
