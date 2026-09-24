"use client";

import type { CSSProperties, ReactNode } from "react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { PhoneMenu } from "@/features/marketing/shared/components/phone-menu";
import { PhoneKDS } from "@/features/marketing/shared/components/phone-kds";
import { PAYMENT_METHODS } from "@/features/marketing/shared/content/payment-methods";
import { INTEGRATIONS } from "@/features/marketing/shared/content/integrations";
import { SHOWCASE_SAMPLES } from "../content/showcase-samples";
import { CheckMark, PlanPill } from "./plan-pill";

type T = (k: string) => string;

const mockCard: CSSProperties = {
  padding: 28,
  borderRadius: 22,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const splitRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
};

function MockEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="epi-eyebrow" style={{ marginBottom: 14, color: "rgba(251,249,228,0.4)" }}>
      {children}
    </div>
  );
}

function Amount({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <span
      style={{
        color: gold ? "var(--epi-gold-400)" : "var(--epi-cream-50)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function OrderVisual({ t, locale }: { t: T; locale: Locale }) {
  const copy = SHOWCASE_SAMPLES[locale].order;
  return (
    <div style={mockCard}>
      <MockEyebrow>{t("redesign.servicesPage.checkoutSim")}</MockEyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {PAYMENT_METHODS[locale].map((p, i) => (
          <div
            key={i}
            style={{
              padding: "20px 14px",
              borderRadius: 12,
              background: `linear-gradient(140deg, ${p.c}, rgba(6,15,27,0.4))`,
              border: "1px solid rgba(245,244,220,0.10)",
              fontSize: 13,
              color: "var(--epi-cream-50)",
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            {p.n}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 18,
          padding: "16px 18px",
          borderRadius: 12,
          background: "rgba(217,174,59,0.14)",
          border: "1px solid rgba(217,174,59,0.30)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--epi-gold-300)",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
            }}
          >
            {copy.who}
          </div>
          <div style={{ fontSize: 16, color: "var(--epi-cream-50)", fontWeight: 600 }}>
            {copy.amount}
          </div>
        </div>
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(37,211,102,0.16)",
            border: "1px solid rgba(37,211,102,0.4)",
            color: "#7ee2a4",
            fontSize: 11,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {copy.paid}
        </div>
      </div>
      <div
        style={{
          ...splitRow,
          marginTop: 8,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--epi-cream-50)", opacity: 0.6 }}>{copy.lands}</span>
        <span
          className="epi-display"
          style={{ color: "var(--epi-gold-400)", fontSize: 18, letterSpacing: "0.04em" }}
        >
          {copy.queue}
        </span>
      </div>
    </div>
  );
}

function TillVisual({ t, locale }: { t: T; locale: Locale }) {
  const till = SHOWCASE_SAMPLES[locale].till;
  const button: CSSProperties = {
    padding: "11px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  return (
    <div style={mockCard}>
      <MockEyebrow>{t("redesign.servicesPage.tillSim")}</MockEyebrow>
      <div
        style={{
          padding: "18px 18px 14px",
          borderRadius: 14,
          background: "var(--epi-cream-50)",
          color: "var(--epi-navy-900)",
          fontSize: 13,
        }}
      >
        <div
          style={{ ...splitRow, paddingBottom: 10, borderBottom: "1px dashed rgba(6,15,27,0.25)" }}
        >
          <span style={{ opacity: 0.7, minWidth: 0 }}>{till.context}</span>
          <span className="epi-display" style={{ fontSize: 18, letterSpacing: "0.04em" }}>
            {till.queue}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
          {till.lines.map((line) => (
            <div key={line.name} style={splitRow}>
              <span style={{ minWidth: 0 }}>
                <span style={{ opacity: 0.55 }}>{line.qty} × </span>
                {line.name}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {line.price}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingTop: 10,
            borderTop: "1px dashed rgba(6,15,27,0.25)",
          }}
        >
          <div style={{ ...splitRow, opacity: 0.7 }}>
            <span>{till.subtotal[0]}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{till.subtotal[1]}</span>
          </div>
          <div style={{ ...splitRow, color: "var(--epi-gold-700)" }}>
            <span style={{ minWidth: 0 }}>{till.coupon[0]}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {till.coupon[1]}
            </span>
          </div>
          <div style={{ ...splitRow, fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            <span>{till.total[0]}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{till.total[1]}</span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto 1fr",
          gap: 8,
          marginTop: 12,
        }}
      >
        <div
          style={{
            ...button,
            border: "1px solid rgba(255,255,255,0.14)",
            color: "var(--epi-cream-50)",
          }}
        >
          {till.save}
        </div>
        <div
          style={{
            ...button,
            border: "1px solid rgba(255,255,255,0.14)",
            color: "var(--epi-cream-50)",
          }}
        >
          {till.split}
        </div>
        <div style={{ ...button, background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}>
          {till.charge}
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--epi-cream-50)",
          opacity: 0.55,
        }}
      >
        <span
          style={{ width: 8, height: 8, borderRadius: 99, background: "#25D366", flexShrink: 0 }}
        />
        {till.synced}
      </div>
    </div>
  );
}

function CustomerVisual({ t, locale }: { t: T; locale: Locale }) {
  const customer = SHOWCASE_SAMPLES[locale].customer;
  return (
    <div style={mockCard}>
      <MockEyebrow>{t("redesign.servicesPage.customerSim")}</MockEyebrow>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.5 }}>
          {customer.phoneLabel}
        </div>
        <div
          style={{
            fontSize: 20,
            color: "var(--epi-cream-50)",
            letterSpacing: "0.04em",
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {customer.phone}
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          padding: 20,
          borderRadius: 14,
          background: "linear-gradient(140deg, rgba(217,174,59,0.22), rgba(217,174,59,0.06))",
          border: "1px solid rgba(217,174,59,0.32)",
        }}
      >
        <div
          className="epi-display"
          style={{
            fontSize: 26,
            letterSpacing: "0.03em",
            color: "var(--epi-cream-50)",
            lineHeight: 1.05,
          }}
        >
          {customer.greeting}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {customer.stats.map((stat) => (
            <span
              key={stat}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(6,15,27,0.35)",
                color: "var(--epi-gold-300)",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {stat}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          ...splitRow,
          alignItems: "center",
          marginTop: 8,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--epi-cream-50)", opacity: 0.6, minWidth: 0 }}>
          {customer.receipt}
        </span>
        <span style={{ color: "#7ee2a4", whiteSpace: "nowrap" }}>{customer.receiptStatus}</span>
      </div>
    </div>
  );
}

function ShiftVisual({ t, locale }: { t: T; locale: Locale }) {
  const shift = SHOWCASE_SAMPLES[locale].shift;
  const line: CSSProperties = {
    ...splitRow,
    padding: "9px 0",
    borderBottom: "1px dashed rgba(255,255,255,0.06)",
    fontSize: 13,
  };
  return (
    <div style={mockCard}>
      <MockEyebrow>{t("redesign.servicesPage.shiftSim")}</MockEyebrow>
      <div
        className="epi-display"
        style={{ fontSize: 28, letterSpacing: "0.04em", color: "var(--epi-cream-50)" }}
      >
        {shift.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--epi-cream-50)", opacity: 0.45, marginTop: 4 }}>
        {shift.started}
      </div>
      <div style={{ marginTop: 14 }}>
        {[...shift.lines, shift.expected].map(([label, value], i) => (
          <div key={label} style={{ ...line, fontWeight: i === shift.lines.length ? 600 : 400 }}>
            <span style={{ color: "var(--epi-cream-50)", opacity: 0.7 }}>{label}</span>
            <Amount>{value}</Amount>
          </div>
        ))}
        <div style={{ ...line, borderBottom: "none" }}>
          <span style={{ color: "var(--epi-cream-50)", opacity: 0.7 }}>{shift.counted[0]}</span>
          <Amount gold>{shift.counted[1]}</Amount>
        </div>
      </div>
      <div
        style={{
          ...splitRow,
          alignItems: "center",
          marginTop: 6,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(37,211,102,0.10)",
          border: "1px solid rgba(37,211,102,0.30)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--epi-cream-50)" }}>
          {shift.difference[0]} · <Amount>{shift.difference[1]}</Amount>
        </span>
        <span style={{ color: "#7ee2a4", fontWeight: 600 }}>{shift.balanced} ✓</span>
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--epi-cream-50)", opacity: 0.45 }}>{shift.clockedIn}</span>
        {shift.staff.map((person) => (
          <span
            key={person.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              color: "var(--epi-cream-50)",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                background: "linear-gradient(140deg, var(--epi-gold-400), var(--epi-gold-700))",
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                color: "var(--epi-navy-900)",
                fontWeight: 700,
              }}
            >
              {person.name[0]}
            </span>
            {person.name} · {person.time}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecipeVisual({ t, locale }: { t: T; locale: Locale }) {
  const recipe = SHOWCASE_SAMPLES[locale].recipe;
  return (
    <div style={mockCard}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="epi-eyebrow" style={{ color: "rgba(251,249,228,0.4)" }}>
            {recipe.label}
          </div>
          <div
            className="epi-display"
            style={{
              fontSize: 28,
              letterSpacing: "0.04em",
              color: "var(--epi-cream-50)",
              marginTop: 6,
            }}
          >
            {recipe.name}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="epi-display"
            style={{
              fontSize: 36,
              color: "var(--epi-gold-400)",
              letterSpacing: "0.02em",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {recipe.cost}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--epi-cream-50)",
              opacity: 0.4,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {recipe.costLabel}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recipe.ingredients.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 16,
              fontSize: 13,
              padding: "8px 0",
              borderBottom:
                i < recipe.ingredients.length - 1 ? "1px dashed rgba(255,255,255,0.06)" : "none",
            }}
          >
            <span style={{ color: "var(--epi-cream-50)" }}>{r.name}</span>
            <span style={{ color: "var(--epi-cream-50)", opacity: 0.5 }}>{r.qty}</span>
            <Amount gold>{r.cost}</Amount>
          </div>
        ))}
      </div>
      <div
        style={{
          ...splitRow,
          alignItems: "center",
          marginTop: 18,
          padding: 14,
          borderRadius: 10,
          background: "rgba(217,174,59,0.08)",
          border: "1px solid rgba(217,174,59,0.24)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--epi-gold-300)" }}>{recipe.margin}</span>
        <span
          className="epi-display"
          style={{
            fontSize: 18,
            letterSpacing: "0.06em",
            color: "var(--epi-gold-300)",
            whiteSpace: "nowrap",
          }}
        >
          {recipe.profit}
        </span>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--epi-cream-50)", opacity: 0.4 }}>
        {t("redesign.servicesPage.recipeSim")}
      </div>
    </div>
  );
}

function ReportVisual({ t, locale }: { t: T; locale: Locale }) {
  const report = SHOWCASE_SAMPLES[locale].report;
  return (
    <div style={mockCard} data-testid="services-report-mockup">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div className="epi-eyebrow" style={{ color: "rgba(251,249,228,0.4)" }}>
            {report.label}
          </div>
          <div
            className="epi-display"
            style={{
              fontSize: 26,
              letterSpacing: "0.04em",
              color: "var(--epi-cream-50)",
              marginTop: 6,
            }}
          >
            {report.headline}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="epi-display"
            style={{
              fontSize: 32,
              color: "var(--epi-gold-400)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {report.delta}
          </div>
          <div style={{ fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.4 }}>
            {report.vs}
          </div>
        </div>
      </div>
      {report.rows.map((row) => (
        <div
          key={row.label}
          style={{
            ...splitRow,
            padding: "12px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            fontSize: 14,
          }}
        >
          <span style={{ color: "var(--epi-cream-50)", opacity: 0.7 }}>{row.label}</span>
          <Amount gold={row.gold}>{row.value}</Amount>
        </div>
      ))}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          fontSize: 12,
          color: "var(--epi-cream-50)",
          opacity: 0.4,
        }}
      >
        {t("redesign.servicesPage.plSettled")}
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center" }}>{children}</div>;
}

const FEATURE_ROWS = [
  { key: "r1", side: "menu" },
  { key: "r2", side: "order" },
  { key: "r3", side: "till" },
  { key: "r4", side: "customer" },
  { key: "r5", side: "kitchen" },
  { key: "r6", side: "shift" },
  { key: "r7", side: "recipe" },
  { key: "r8", side: "report" },
] as const;

type Side = (typeof FEATURE_ROWS)[number]["side"];

const MORE_TILES = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"] as const;

export function FeaturesShowcaseSection() {
  const { t, locale } = useI18n();

  function getVisual(side: Side) {
    switch (side) {
      case "menu":
        return (
          <PhoneFrame>
            <PhoneMenu />
          </PhoneFrame>
        );
      case "order":
        return <OrderVisual t={t} locale={locale} />;
      case "till":
        return <TillVisual t={t} locale={locale} />;
      case "customer":
        return <CustomerVisual t={t} locale={locale} />;
      case "kitchen":
        return (
          <PhoneFrame>
            <PhoneKDS />
          </PhoneFrame>
        );
      case "shift":
        return <ShiftVisual t={t} locale={locale} />;
      case "recipe":
        return <RecipeVisual t={t} locale={locale} />;
      case "report":
        return <ReportVisual t={t} locale={locale} />;
    }
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
              style={{
                gap: 64,
                alignItems: "center",
                padding: "64px 0",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div className="epi-eyebrow">{t(`redesign.servicesPage.${key}eyebrow`)}</div>
                  <PlanPill label={t(`redesign.servicesPage.${key}plan`)} />
                </div>
                <h3
                  className="epi-display"
                  style={{
                    fontSize: "clamp(32px, 4vw, 56px)",
                    margin: 0,
                    lineHeight: 0.95,
                    color: "var(--epi-cream-50)",
                  }}
                >
                  {t(`redesign.servicesPage.${key}title`)}
                </h3>
                <p
                  style={{
                    color: "var(--epi-cream-50)",
                    opacity: 0.65,
                    fontSize: 16,
                    lineHeight: 1.6,
                    marginTop: 20,
                  }}
                >
                  {t(`redesign.servicesPage.${key}body`)}
                </p>
                <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        color: "var(--epi-cream-50)",
                        fontSize: 14,
                        lineHeight: 1.4,
                      }}
                    >
                      <CheckMark />
                      {t(`redesign.servicesPage.${key}b${n}`)}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ order: i % 2 === 0 ? 2 : 1, minWidth: 0 }}>{getVisual(side)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* And also: the smaller features that don't need a row of their own */}
      <section className="epi-section epi-section--tight">
        <div className="epi-container">
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 40 }}>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
              {t("redesign.servicesPage.moreEyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(36px, 4.5vw, 64px)",
                margin: 0,
                lineHeight: 0.95,
                color: "var(--epi-cream-50)",
              }}
            >
              {t("redesign.servicesPage.moreTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MORE_TILES.map((key) => (
              <div
                key={key}
                style={{
                  padding: 22,
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--epi-font-display)",
                      fontSize: 20,
                      letterSpacing: "0.04em",
                      color: "var(--epi-cream-50)",
                    }}
                  >
                    {t(`redesign.servicesPage.${key}title`)}
                  </div>
                  <PlanPill label={t(`redesign.servicesPage.${key}plan`)} />
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--epi-cream-50)",
                    opacity: 0.62,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {t(`redesign.servicesPage.${key}body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="epi-section">
        <div className="epi-container">
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", marginBottom: 48 }}>
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
              {t("redesign.servicesPage.intEyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(40px, 5vw, 72px)",
                margin: 0,
                lineHeight: 0.95,
                color: "var(--epi-cream-50)",
              }}
            >
              {t("redesign.servicesPage.intTitle1")}
              <br />
              {t("redesign.servicesPage.intTitle2")}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14 }}>
            {INTEGRATIONS[locale].map((name, i) => (
              <div
                key={i}
                style={{
                  padding: "20px 16px",
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textAlign: "center",
                  fontFamily: "var(--epi-font-display)",
                  fontSize: 18,
                  letterSpacing: "0.06em",
                  color: "var(--epi-cream-50)",
                }}
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
