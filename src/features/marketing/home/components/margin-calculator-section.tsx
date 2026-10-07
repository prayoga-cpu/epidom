"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import {
  formatPlanPrice,
  LOCALE_PRICE_CURRENCY,
  type PaidPlan,
  type PriceCurrency,
} from "@/lib/constants/plan-pricing";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import {
  clamp,
  computeMargin,
  MONEY_INPUTS,
  PAYMENT_FEE,
  PERCENT_INPUTS,
  savingBucket,
  type CalculatorInputs,
  type Range,
} from "../lib/margin-calculator";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON, SectionHeading, SourceRef } from "./landing-ui";

type MoneyField = "revenue" | "averageOrder" | "currentPosFee";
type PercentField = "deliveryShare" | "commission" | "movedShare" | "currentMargin";
type Field = MoneyField | PercentField;

const PERCENT_FIELDS: readonly PercentField[] = [
  "deliveryShare",
  "commission",
  "movedShare",
  "currentMargin",
];

/** Where the currency symbol sits next to an amount field. */
const CURRENCY_AFFIX: Record<PriceCurrency, { symbol: string; side: "prefix" | "suffix" }> = {
  EUR: { symbol: "€", side: "suffix" },
  USD: { symbol: "$", side: "prefix" },
  IDR: { symbol: "Rp", side: "prefix" },
};

function defaultValues(currency: PriceCurrency): Record<Field, string> {
  const money = MONEY_INPUTS[currency];
  return {
    revenue: String(money.revenue.default),
    averageOrder: String(money.averageOrder.default),
    currentPosFee: String(money.currentPosFee.default),
    deliveryShare: String(PERCENT_INPUTS.deliveryShare.default),
    commission: String(PERCENT_INPUTS.commission.default),
    movedShare: String(PERCENT_INPUTS.movedShare.default),
    currentMargin: String(PERCENT_INPUTS.currentMargin.default),
  };
}

function rangeFor(field: Field, currency: PriceCurrency): Range {
  return (PERCENT_FIELDS as readonly string[]).includes(field)
    ? PERCENT_INPUTS[field as PercentField]
    : MONEY_INPUTS[currency][field as MoneyField];
}

/** A typed value, clamped to its field's range. A blank field counts as its minimum. */
function parseField(raw: string, range: Range): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  return clamp(Number.isFinite(n) ? n : range.min, range);
}

/**
 * "How much is your current setup costing you?". The visitor's own numbers;
 * nothing is sent or saved, and every assumption (payment fee, plan price) is
 * shown under the result. A negative result is said plainly.
 */
export function MarginCalculatorSection({
  preset,
}: {
  /** Set by the problem picker: `nonce` changes on every click, so the same rate can be re-applied. */
  preset: { commission: number; nonce: number } | null;
}) {
  const { t, locale } = useI18n();
  const currency = LOCALE_PRICE_CURRENCY[locale];
  const intlLocale = INTL_LOCALES[locale];
  const trialHref = usePosTrialHref();
  const [values, setValues] = useState(() => defaultValues(currency));
  const [plan, setPlan] = useState<PaidPlan>("POS");
  const started = useRef(false);
  const completed = useRef(false);
  const resultVisible = useRef(false);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  // A language switch changes the currency: start again from its defaults.
  useEffect(() => {
    setValues(defaultValues(currency));
  }, [currency]);

  useEffect(() => {
    if (preset) setValues((v) => ({ ...v, commission: String(preset.commission) }));
  }, [preset]);

  const inputs: CalculatorInputs = useMemo(() => {
    const get = (field: Field) => parseField(values[field], rangeFor(field, currency));
    return {
      revenue: get("revenue"),
      averageOrder: get("averageOrder"),
      currentPosFee: get("currentPosFee"),
      deliveryShare: get("deliveryShare") / 100,
      commission: get("commission") / 100,
      movedShare: get("movedShare") / 100,
      currentMargin: get("currentMargin") / 100,
      plan,
    };
  }, [values, plan, currency]);

  const result = useMemo(() => computeMargin(inputs, currency), [inputs, currency]);
  const negative = result.monthlySaving < 0;

  const money = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [intlLocale, currency]
  );
  const precise = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 2 }),
    [intlLocale, currency]
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 1 }),
    [intlLocale]
  );

  // The latest plan and saving, for the delayed "complete" event below.
  const latest = useRef({ plan, monthlySaving: result.monthlySaving });
  useEffect(() => {
    latest.current = { plan, monthlySaving: result.monthlySaving };
  }, [plan, result.monthlySaving]);

  /**
   * "Result viewed": the visitor has changed something, and the result then
   * stayed on screen for 1.5 s without another change. On a wide screen the
   * result sits next to the inputs, so being on screen alone would count every
   * first keystroke as a completion.
   */
  const scheduleComplete = useCallback(() => {
    if (completed.current || !started.current || !resultVisible.current) return;
    if (completeTimer.current) clearTimeout(completeTimer.current);
    completeTimer.current = setTimeout(() => {
      if (completed.current || !resultVisible.current) return;
      completed.current = true;
      trackEvent("calculator_complete", {
        plan: latest.current.plan,
        monthly_saving_bucket: savingBucket(latest.current.monthlySaving, currency),
      });
    }, 1500);
  }, [currency]);

  useEffect(() => {
    const node = resultRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        resultVisible.current = entries.some((e) => e.isIntersecting);
        if (resultVisible.current) scheduleComplete();
        else if (completeTimer.current) clearTimeout(completeTimer.current);
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (completeTimer.current) clearTimeout(completeTimer.current);
    };
  }, [scheduleComplete]);

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      trackEvent("calculator_start");
    }
    scheduleComplete();
  };

  const update = (field: Field, raw: string) => {
    setValues((v) => ({ ...v, [field]: raw }));
    markStarted();
  };

  const fee = PAYMENT_FEE[currency];
  const feeText =
    percent.format(fee.percent) + (fee.flat > 0 ? ` + ${precise.format(fee.flat)}` : "");
  const planName = t(`redesign.landing.plans.${plan === "POS" ? "pos" : "operations"}`);

  const ctaHref = negative
    ? "/register"
    : plan === "POS"
      ? trialHref
      : `${getLocalizedPath("/pricing", locale)}#plans`;
  const ctaLabel = negative
    ? t("redesign.landing.calculator.ctaFree")
    : t("redesign.landing.calculator.cta");

  const barMax = Math.max(inputs.currentMargin, result.newMargin, 0.05) * 1.15;
  const barWidth = (value: number) => `${Math.max(0, Math.min(1, value / barMax)) * 100}%`;

  const field = (name: Field, labelKey: string, sourceId?: "S1" | "S3") => {
    const isPercent = (PERCENT_FIELDS as readonly string[]).includes(name);
    const range = rangeFor(name, currency);
    const affix = isPercent ? { symbol: "%", side: "suffix" as const } : CURRENCY_AFFIX[currency];
    const inputId = `${idPrefix}-${name}`;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-epi-cream-50/80 text-sm">
          {t(`redesign.landing.calculator.${labelKey}`)}
          {sourceId ? <SourceRef id={sourceId} /> : null}
        </label>
        <div className="relative">
          {affix.side === "prefix" ? (
            <span
              aria-hidden="true"
              className="text-epi-cream-50/50 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            >
              {affix.symbol}
            </span>
          ) : null}
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={range.min}
            max={range.max}
            step={range.step}
            value={values[name]}
            onChange={(e) => update(name, e.target.value)}
            onBlur={() => setValues((v) => ({ ...v, [name]: String(parseField(v[name], range)) }))}
            className={cn(
              "bg-epi-navy-850 text-epi-cream-50 focus-visible:border-epi-gold-500 h-12 w-full rounded-xl border border-white/15 text-base outline-none",
              affix.side === "prefix"
                ? affix.symbol.length > 1
                  ? "pr-4 pl-12"
                  : "pr-4 pl-9"
                : "pr-10 pl-4"
            )}
          />
          {affix.side === "suffix" ? (
            <span
              aria-hidden="true"
              className="text-epi-cream-50/50 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
            >
              {affix.symbol}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const movedId = `${idPrefix}-movedShare`;
  const movedRange = PERCENT_INPUTS.movedShare;

  return (
    <section
      id="calculator"
      aria-labelledby="calculator-title"
      className="epi-section via-epi-navy-850/60 scroll-mt-24 bg-gradient-to-b from-transparent to-transparent"
    >
      <div className="epi-container">
        <SectionHeading
          id="calculator-title"
          eyebrow={t("redesign.landing.calculator.eyebrow")}
          title={t("redesign.landing.calculator.title")}
          sub={t("redesign.landing.calculator.sub")}
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2 sm:p-8"
          >
            {field("revenue", "revenue")}
            {field("averageOrder", "averageOrder")}
            {field("deliveryShare", "deliveryShare")}
            {field("commission", "commission", "S1")}

            <div className="flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={movedId} className="text-epi-cream-50/80 text-sm">
                  {t("redesign.landing.calculator.movedShare")}
                </label>
                <output htmlFor={movedId} className="text-epi-gold-300 text-base font-medium">
                  {percent.format(inputs.movedShare)}
                </output>
              </div>
              <input
                id={movedId}
                type="range"
                min={movedRange.min}
                max={movedRange.max}
                step={movedRange.step}
                value={values.movedShare}
                onChange={(e) => update("movedShare", e.target.value)}
                className="accent-epi-gold-500 h-11 w-full cursor-pointer"
              />
            </div>

            {field("currentPosFee", "currentPosFee")}
            {field("currentMargin", "currentMargin", "S3")}

            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 sm:col-span-2">
              <legend className="text-epi-cream-50/80 mb-2 text-sm">
                {t("redesign.landing.calculator.plan")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["POS", "OPERATIONS"] as const).map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "has-[:focus-visible]:outline-epi-gold-300 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors has-[:focus-visible]:outline-2",
                      plan === p
                        ? "border-epi-gold-500 bg-epi-gold-500/15 text-epi-cream-50"
                        : "text-epi-cream-50/80 border-white/15"
                    )}
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-plan`}
                      value={p}
                      checked={plan === p}
                      onChange={() => {
                        setPlan(p);
                        markStarted();
                      }}
                      className="sr-only"
                    />
                    <span className="flex flex-col items-center leading-tight">
                      <span>
                        {t(`redesign.landing.plans.${p === "POS" ? "pos" : "operations"}`)}
                      </span>
                      <span className="text-xs opacity-70">
                        {formatPlanPrice(p, currency, "monthly")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-epi-cream-50/55 m-0 mt-1 text-xs leading-relaxed">
                {t("redesign.landing.calculator.planNote")}
              </p>
            </fieldset>
          </form>

          <div
            ref={resultRef}
            aria-live="polite"
            className="border-epi-gold-500/30 from-epi-gold-500/10 to-epi-gold-500/[0.02] flex flex-col gap-6 rounded-3xl border bg-gradient-to-b p-5 sm:p-8"
          >
            <p className="text-epi-cream-50/85 m-0 text-base leading-relaxed">
              {t("redesign.landing.calculator.commissionToday").replace(
                "{amount}",
                money.format(result.commissionNow)
              )}
            </p>

            {negative ? (
              <p className="text-epi-cream-50 m-0 rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-base leading-relaxed">
                {t("redesign.landing.calculator.negative").replace(
                  "{amount}",
                  money.format(-result.monthlySaving)
                )}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-epi-cream-50/55 text-xs tracking-[0.16em] uppercase">
                    {t("redesign.landing.calculator.monthlySaving")}
                  </div>
                  <div className="epi-display text-epi-cream-50 mt-2 text-[clamp(36px,5vw,56px)] leading-none break-words">
                    {money.format(result.monthlySaving)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-epi-cream-50/55 text-xs tracking-[0.16em] uppercase">
                    {t("redesign.landing.calculator.yearlySaving")}
                  </div>
                  <div className="epi-display text-epi-gold-300 mt-2 text-[clamp(24px,3vw,34px)] leading-none break-words">
                    {money.format(result.yearlySaving)}
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-epi-cream-50/85 m-0 text-sm">
                {t("redesign.landing.calculator.marginChange")
                  .replace("{from}", percent.format(inputs.currentMargin))
                  .replace("{to}", percent.format(result.newMargin))}
              </p>
              <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
                {[
                  {
                    label: t("redesign.landing.calculator.marginBefore"),
                    value: inputs.currentMargin,
                    bar: "bg-white/35",
                  },
                  {
                    label: t("redesign.landing.calculator.marginAfter"),
                    value: result.newMargin,
                    bar: "bg-epi-gold-500",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3"
                  >
                    <span className="text-epi-cream-50/60 truncate text-xs">{row.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <span
                        className={cn("block h-full rounded-full transition-[width]", row.bar)}
                        style={{ width: barWidth(row.value) }}
                      />
                    </span>
                    <span className="text-epi-cream-50/80 text-right text-xs">
                      {percent.format(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="text-epi-cream-50/55 m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed">
              <li>
                {t("redesign.landing.calculator.feeAssumption").replace("{fee}", feeText)}
                <SourceRef id={fee.source} />
              </li>
              <li>
                {t("redesign.landing.calculator.planAssumption")
                  .replace("{plan}", planName)
                  .replace("{price}", formatPlanPrice(plan, currency, "monthly"))}
              </li>
            </ul>

            <div className="flex flex-col gap-3">
              <Link
                href={ctaHref}
                onClick={() =>
                  trackEvent("calculator_cta_click", { plan: negative ? "FREE" : plan })
                }
                className={PRIMARY_BUTTON}
              >
                {ctaLabel}
              </Link>
              <p className="text-epi-cream-50/50 m-0 text-xs">
                {t("redesign.landing.calculator.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
