"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { INTL_LOCALES, useI18n, type Locale } from "@/components/lang/i18n-provider";
import { LOCALE_PRICE_CURRENCY } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";
import { computeRecipeCost, type RecipeIngredient } from "../lib/recipe-cost";

/**
 * Example recipe the calculator opens with, in the language's own kitchen and
 * currency: example figures to overwrite, not claims about real prices.
 */
const EXAMPLE: Record<
  Locale,
  {
    rows: Array<Omit<RecipeIngredient, "name">>;
    portions: number;
    extra: number;
  }
> = {
  // 12 croissants: flour, butter, milk (euros, grams/ml)
  fr: {
    rows: [
      { packPrice: 1.2, packSize: 1000, quantityUsed: 500 },
      { packPrice: 9, packSize: 1000, quantityUsed: 280 },
      { packPrice: 1.1, packSize: 1000, quantityUsed: 150 },
    ],
    portions: 12,
    extra: 0.05,
  },
  // One iced kopi susu: coffee, fresh milk, palm sugar (rupiah, grams/ml)
  id: {
    rows: [
      { packPrice: 150000, packSize: 1000, quantityUsed: 18 },
      { packPrice: 22000, packSize: 1000, quantityUsed: 150 },
      { packPrice: 40000, packSize: 1000, quantityUsed: 20 },
    ],
    portions: 1,
    extra: 1500,
  },
  // 12 muffins: flour, butter, blueberries (dollars, grams)
  en: {
    rows: [
      { packPrice: 4, packSize: 2000, quantityUsed: 300 },
      { packPrice: 5, packSize: 450, quantityUsed: 115 },
      { packPrice: 4.5, packSize: 340, quantityUsed: 200 },
    ],
    portions: 12,
    extra: 0.1,
  },
};

interface Row {
  key: number;
  name: string;
  packPrice: string;
  packSize: string;
  quantityUsed: string;
}

/** "1,5" and "1.5" both read as 1.5; anything else as 0. */
function num(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function exampleRows(locale: Locale, names: string[]): Row[] {
  return EXAMPLE[locale].rows.map((r, i) => ({
    key: i,
    name: names[i] ?? "",
    packPrice: String(r.packPrice),
    packSize: String(r.packSize),
    quantityUsed: String(r.quantityUsed),
  }));
}

const INPUT =
  "bg-epi-navy-850 text-epi-cream-50 focus-visible:border-epi-gold-500 h-11 w-full min-w-0 rounded-xl border border-white/15 px-3 text-base outline-none";

/**
 * Coût de revient / HPP / recipe cost: the visitor's own ingredients, priced
 * per portion, and the price that keeps ingredients at a target share. Opens
 * on an example in the page's language and currency. Nothing is sent or saved.
 */
export function RecipeCostCalculator() {
  const { t, locale } = useI18n();
  const idPrefix = useId();
  const currency = LOCALE_PRICE_CURRENCY[locale];
  const names = [
    t("landing.recipeCost.example.ingredient1"),
    t("landing.recipeCost.example.ingredient2"),
    t("landing.recipeCost.example.ingredient3"),
  ];

  const [rows, setRows] = useState<Row[]>(() => exampleRows(locale, names));
  const [nextKey, setNextKey] = useState(rows.length);
  const [portions, setPortions] = useState(String(EXAMPLE[locale].portions));
  const [extra, setExtra] = useState(String(EXAMPLE[locale].extra));
  const [target, setTarget] = useState("30");
  const [price, setPrice] = useState("");

  const result = useMemo(
    () =>
      computeRecipeCost({
        ingredients: rows.map((r) => ({
          name: r.name,
          packPrice: num(r.packPrice),
          packSize: num(r.packSize),
          quantityUsed: num(r.quantityUsed),
        })),
        portions: num(portions),
        extraPerPortion: num(extra),
        targetFoodCost: num(target) / 100,
        sellingPrice: price.trim() ? num(price) : undefined,
      }),
    [rows, portions, extra, target, price]
  );

  const money = useMemo(
    () =>
      new Intl.NumberFormat(INTL_LOCALES[locale], {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "IDR" ? 0 : 2,
      }),
    [locale, currency]
  );
  const pct = useMemo(
    () =>
      new Intl.NumberFormat(INTL_LOCALES[locale], { style: "percent", maximumFractionDigits: 1 }),
    [locale]
  );

  const update = (key: number, field: keyof Omit<Row, "key">, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const addRow = () => {
    setRows((rs) => [
      ...rs,
      { key: nextKey, name: "", packPrice: "", packSize: "", quantityUsed: "" },
    ]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const negative = result.grossMarginPerPortion !== null && result.grossMarginPerPortion < 0;
  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    suffix?: string
  ) => (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-epi-cream-50/80 text-sm">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT, suffix && "pr-10")}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="text-epi-cream-50/50 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex min-w-0 flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-8"
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <legend className="text-epi-cream-50 mb-1 text-base font-medium">
            {t("landing.recipeCost.ingredients")}
          </legend>
          <p className="text-epi-cream-50/55 m-0 text-xs leading-relaxed">
            {t("landing.recipeCost.unitHint")}
          </p>
          {rows.map((row, i) => {
            const base = `${idPrefix}-row-${row.key}`;
            return (
              <div
                key={row.key}
                className="grid min-w-0 grid-cols-2 gap-3 rounded-2xl border border-white/10 p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-end sm:border-0 sm:p-0"
              >
                <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
                  <label htmlFor={`${base}-name`} className="text-epi-cream-50/60 text-xs">
                    {t("landing.recipeCost.ingredient")} {i + 1}
                  </label>
                  <input
                    id={`${base}-name`}
                    value={row.name}
                    onChange={(e) => update(row.key, "name", e.target.value)}
                    className={INPUT}
                  />
                </div>
                {(["packPrice", "packSize", "quantityUsed"] as const).map((f) => (
                  <div key={f} className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor={`${base}-${f}`} className="text-epi-cream-50/60 text-xs">
                      {t(`landing.recipeCost.${f}`)}
                    </label>
                    <input
                      id={`${base}-${f}`}
                      inputMode="decimal"
                      value={row[f]}
                      onChange={(e) => update(row.key, f, e.target.value)}
                      className={INPUT}
                    />
                  </div>
                ))}
                <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
                  <span className="text-epi-cream-50/70 text-sm tabular-nums sm:hidden">
                    {t("landing.recipeCost.lineCost")}:{" "}
                    {money.format(result.ingredientCosts[i] ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    aria-label={`${t("landing.recipeCost.removeIngredient")} ${row.name || i + 1}`}
                    className="text-epi-cream-50/60 hover:text-epi-cream-50 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addRow}
            className="text-epi-gold-300 hover:text-epi-gold-400 inline-flex min-h-11 items-center gap-2 self-start rounded-xl text-sm font-medium"
          >
            <Plus className="size-4" />
            {t("landing.recipeCost.addIngredient")}
          </button>
        </fieldset>

        <div className="grid min-w-0 gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          {field(`${idPrefix}-portions`, t("landing.recipeCost.portions"), portions, setPortions)}
          {field(`${idPrefix}-extra`, t("landing.recipeCost.extraPerPortion"), extra, setExtra)}
          {field(
            `${idPrefix}-target`,
            t("landing.recipeCost.targetFoodCost"),
            target,
            setTarget,
            "%"
          )}
          {field(`${idPrefix}-price`, t("landing.recipeCost.sellingPrice"), price, setPrice)}
        </div>
      </form>

      <div
        aria-live="polite"
        className="border-epi-gold-500/30 from-epi-gold-500/10 to-epi-gold-500/[0.02] flex min-w-0 flex-col gap-5 self-start rounded-3xl border bg-gradient-to-b p-5 sm:p-8"
      >
        <div className="text-epi-cream-50/55 text-xs tracking-[0.16em] uppercase">
          {t("landing.recipeCost.costPerPortion")}
        </div>
        <div className="epi-display text-epi-cream-50 -mt-3 text-[clamp(36px,5vw,56px)] leading-none break-words">
          {money.format(result.costPerPortion)}
        </div>
        <dl className="m-0 grid gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-epi-cream-50/70">{t("landing.recipeCost.batchCost")}</dt>
            <dd className="text-epi-cream-50 m-0 tabular-nums">{money.format(result.batchCost)}</dd>
          </div>
          {result.suggestedPrice !== null && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-epi-cream-50/70">
                {t("landing.recipeCost.suggestedPrice").replace(
                  "{pct}",
                  pct.format(num(target) / 100)
                )}
              </dt>
              <dd className="text-epi-gold-300 m-0 text-base font-medium tabular-nums">
                {money.format(result.suggestedPrice)}
              </dd>
            </div>
          )}
          {result.foodCostShare !== null && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-epi-cream-50/70">{t("landing.recipeCost.foodCostShare")}</dt>
                <dd className="text-epi-cream-50 m-0 tabular-nums">
                  {pct.format(result.foodCostShare)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-epi-cream-50/70">{t("landing.recipeCost.grossMargin")}</dt>
                <dd
                  className={cn(
                    "m-0 tabular-nums",
                    negative ? "text-red-300" : "text-epi-cream-50"
                  )}
                >
                  {money.format(result.grossMarginPerPortion ?? 0)}
                  {result.grossMarginShare !== null
                    ? ` (${pct.format(result.grossMarginShare)})`
                    : ""}
                </dd>
              </div>
            </>
          )}
        </dl>
        {negative && (
          <p className="text-epi-cream-50 m-0 rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-sm leading-relaxed">
            {t("landing.recipeCost.negative")}
          </p>
        )}
        <p className="text-epi-cream-50/55 m-0 text-xs leading-relaxed">
          {t("landing.recipeCost.note")}
        </p>
      </div>
    </div>
  );
}
