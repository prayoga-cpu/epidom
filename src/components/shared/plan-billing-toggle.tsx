"use client";

import type * as React from "react";
import { ChevronDown } from "lucide-react";
import { PRICE_CURRENCIES, type PriceCurrency } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";

/**
 * One rounded bar for how a plan is priced: Monthly | Yearly, a divider, then
 * the currency as a dropdown, all the same height. Used on the pricing page
 * (tone "dark", the marketing site's always-dark look) and in setup (tone
 * "surface", which follows the app theme).
 */
export function PlanBillingToggle({
  yearly,
  onYearlyChange,
  currency,
  onCurrencyChange,
  monthlyLabel,
  yearlyLabel,
  groupLabel,
  currencyLabel,
  tone = "surface",
  disabled = false,
  className,
}: {
  yearly: boolean;
  onYearlyChange: (yearly: boolean) => void;
  currency: PriceCurrency;
  onCurrencyChange: (currency: PriceCurrency) => void;
  monthlyLabel: React.ReactNode;
  yearlyLabel: React.ReactNode;
  groupLabel: string;
  currencyLabel: string;
  tone?: "surface" | "dark";
  disabled?: boolean;
  className?: string;
}) {
  const dark = tone === "dark";
  const pill = (pressed: boolean) =>
    cn(
      "min-h-10 rounded-full px-2.5 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase transition-colors outline-none sm:px-5 sm:text-xs sm:tracking-wider",
      "focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60",
      pressed
        ? "bg-[var(--epi-cream-50)] text-[var(--epi-navy-900)]"
        : dark
          ? "text-[rgba(251,249,228,0.55)] hover:text-[var(--epi-cream-50)]"
          : "text-muted-foreground hover:text-foreground"
    );
  const muted = dark
    ? "text-[rgba(251,249,228,0.55)] hover:text-[var(--epi-cream-50)]"
    : "text-muted-foreground hover:text-foreground";

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn(
        "mx-auto flex w-fit max-w-full items-center rounded-full border p-0.5 sm:p-1",
        dark ? "border-white/10 bg-white/5" : "border-border bg-card",
        className
      )}
    >
      <button
        type="button"
        data-testid="interval-monthly"
        aria-pressed={!yearly}
        disabled={disabled}
        onClick={() => onYearlyChange(false)}
        className={pill(!yearly)}
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        data-testid="interval-yearly"
        aria-pressed={yearly}
        disabled={disabled}
        onClick={() => onYearlyChange(true)}
        className={pill(yearly)}
      >
        {yearlyLabel}
      </button>
      <span
        aria-hidden="true"
        className={cn("mx-0.5 h-5 w-px shrink-0 sm:mx-1", dark ? "bg-white/10" : "bg-border")}
      />
      <div className="relative">
        <select
          data-testid="plan-currency"
          aria-label={currencyLabel}
          value={currency}
          disabled={disabled}
          onChange={(event) => onCurrencyChange(event.target.value as PriceCurrency)}
          className={cn(
            "focus-visible:ring-ring/50 h-10 cursor-pointer appearance-none rounded-full bg-transparent py-0 pr-6 pl-2.5 text-[10px] font-semibold tracking-wide uppercase outline-none focus-visible:ring-[3px] disabled:opacity-60 sm:pr-8 sm:pl-4 sm:text-xs sm:tracking-wider",
            muted
          )}
        >
          {PRICE_CURRENCIES.map((option) => (
            <option key={option} value={option} className="text-black">
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 sm:right-3",
            dark ? "text-[rgba(251,249,228,0.55)]" : "text-muted-foreground"
          )}
        />
      </div>
    </div>
  );
}
