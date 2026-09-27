"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { OTHER_COUNTRY_CODE, resolveMarketDefaults } from "@/lib/onboarding/markets";
import { PAYMENT_METHODS_BY_MARKET, PAYMENT_METHOD_LABELS } from "@/config/payment-fees.config";
import { ONLINE_PLATFORMS_BY_MARKET, ONLINE_PLATFORM_LABELS } from "@/config/aggregator.config";
import { CURRENCIES } from "@/lib/constants/currencies";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { SearchSelect, type SearchSelectOption, type SearchSelectProps } from "./search-select";

/** Offered first in the "Other country" currency picker. */
const COMMON_CURRENCIES = ["USD", "EUR", "GBP"];

export interface MarketSummaryProps {
  /** ISO code, or OTHER_COUNTRY_CODE; nothing renders while it is empty. */
  countryCode?: string | null;
  /** "Other country" only: the currency the owner picked. */
  currency?: string | null;
  /** "Other country" only: when given, the currency row becomes a picker. */
  onCurrencyChange?: (currency: string) => void;
  /** Used for the timezone when it belongs to the country (see resolveMarketDefaults). */
  browserTimezone?: string | null;
  /**
   * The time zone this form will actually apply. Left undefined (the default),
   * the row shows the zone the country implies, as the setup wizard applies it.
   * A string is shown as-is: the Create a store dialog passes the business's
   * zone, since the time zone is shared by every store and creating one never
   * changes it. null hides the row (the zone is unknown, or not set here).
   */
  timezone?: string | null;
  className?: string;
  /** Form wiring for the "Other country" currency picker (id, aria-*, onBlur, ref). */
  currencySelectProps?: Pick<
    SearchSelectProps,
    "id" | "name" | "onBlur" | "ref" | "disabled" | "aria-invalid" | "aria-describedby"
  >;
}

function localizedCurrencyName(code: string, locale: Locale): string | undefined {
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

function listFormat(items: string[], locale: Locale): string {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** "Europe/Paris (UTC+2)", underscores as spaces ("America/New York"). */
function timezoneLabel(timezone: string, locale: Locale): string {
  const name = timezone.replace(/_/g, " ");
  try {
    const offset = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${name} (${offset})` : name;
  } catch {
    return name;
  }
}

export function buildCurrencyOptions(locale: Locale): SearchSelectOption[] {
  return CURRENCIES.map((currency) => {
    const localized = localizedCurrencyName(currency.code, locale);
    return {
      value: currency.code,
      label: `${currency.code} · ${localized ?? currency.name}`,
      keywords: [currency.code, currency.name, ...(localized ? [localized] : [])],
      section: COMMON_CURRENCIES.includes(currency.code) ? 0 : 1,
    };
  }).sort((a, b) => {
    if (a.section !== b.section) return (a.section ?? 0) - (b.section ?? 0);
    if (a.section === 0)
      return COMMON_CURRENCIES.indexOf(a.value) - COMMON_CURRENCIES.indexOf(b.value);
    return a.value.localeCompare(b.value);
  });
}

/**
 * A small muted panel of what choosing the country fills in automatically:
 * currency, business timezone, payment methods and delivery platforms (from
 * the country's payment market), plus where to change them later. For "Other
 * country" the currency is the owner's choice, so it shows a currency picker
 * (when `onCurrencyChange` is given) instead of a fixed currency.
 */
export function MarketSummary({
  countryCode,
  currency,
  onCurrencyChange,
  browserTimezone,
  timezone,
  className,
  currencySelectProps,
}: MarketSummaryProps) {
  const { t, locale } = useI18n();
  const titleId = React.useId();
  const currencyLabelId = React.useId();
  const currencyOptions = React.useMemo(() => buildCurrencyOptions(locale), [locale]);

  if (!countryCode) return null;

  const isOther = countryCode.toUpperCase() === OTHER_COUNTRY_CODE;
  const defaults = resolveMarketDefaults({
    countryCode,
    browserTimezone,
    currency: isOther ? currency : undefined,
    uiLocale: locale,
  });

  const paymentMethodLabel = (method: PaymentMethod) => {
    const key = `publicOrder.paymentMethods.${method}`;
    const label = t(key);
    return label === key ? PAYMENT_METHOD_LABELS[method] : label;
  };
  const paymentMethods = PAYMENT_METHODS_BY_MARKET[defaults.market].map(paymentMethodLabel);
  const platforms = ONLINE_PLATFORMS_BY_MARKET[defaults.market]
    .filter((platform) => platform !== "OTHER_ONLINE")
    .map((platform) => ONLINE_PLATFORM_LABELS[platform]);

  const shownTimezone = timezone === undefined ? defaults.timezone : timezone;

  const symbol = getCurrencySymbol(defaults.currency);
  const currencyName = localizedCurrencyName(defaults.currency, locale);
  const fixedCurrency = (
    <>
      <span className="font-medium">
        {defaults.currency}
        {symbol && symbol !== defaults.currency ? ` (${symbol})` : ""}
      </span>
      {currencyName ? <span className="text-muted-foreground"> · {currencyName}</span> : null}
    </>
  );

  const rowClass = "grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3";
  const termClass = "text-muted-foreground";

  return (
    <section
      aria-labelledby={titleId}
      data-testid="market-summary"
      className={cn("bg-muted/40 rounded-lg border p-3 text-sm sm:p-4", className)}
    >
      <p id={titleId} className="flex items-center gap-2 font-medium">
        <Sparkles aria-hidden className="size-4 shrink-0 text-[var(--epi-gold-600)]" />
        {t("storeEssentials.marketSummary.title")}
      </p>
      <dl className="mt-3 grid gap-2.5">
        <div className={rowClass}>
          <dt
            id={currencyLabelId}
            className={cn(termClass, isOther && onCurrencyChange && "sm:pt-3")}
          >
            {t("storeEssentials.marketSummary.currency")}
          </dt>
          <dd className="min-w-0">
            {isOther && onCurrencyChange ? (
              <div className="space-y-1">
                <SearchSelect
                  {...currencySelectProps}
                  aria-labelledby={currencyLabelId}
                  options={currencyOptions}
                  value={currency ?? undefined}
                  onChange={onCurrencyChange}
                  placeholder={t("storeEssentials.marketSummary.chooseCurrency")}
                  searchPlaceholder={t("storeEssentials.marketSummary.currencySearchPlaceholder")}
                  emptyText={t("storeEssentials.marketSummary.currencyEmpty")}
                  className="bg-background"
                />
                <p className="text-muted-foreground text-xs">
                  {t("storeEssentials.marketSummary.otherCurrencyHint")}
                </p>
              </div>
            ) : (
              fixedCurrency
            )}
          </dd>
        </div>
        {shownTimezone ? (
          <div className={rowClass}>
            <dt className={termClass}>{t("storeEssentials.marketSummary.timezone")}</dt>
            <dd className="min-w-0 break-words">{timezoneLabel(shownTimezone, locale)}</dd>
          </div>
        ) : null}
        <div className={rowClass}>
          <dt className={termClass}>{t("storeEssentials.marketSummary.paymentMethods")}</dt>
          <dd className="min-w-0 break-words">{listFormat(paymentMethods, locale)}</dd>
        </div>
        {platforms.length > 0 ? (
          <div className={rowClass}>
            <dt className={termClass}>{t("storeEssentials.marketSummary.deliveryPlatforms")}</dt>
            <dd className="min-w-0 break-words">{listFormat(platforms, locale)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-muted-foreground mt-3 text-xs">
        {t("storeEssentials.marketSummary.changeLater")}
      </p>
      {/* The zone is the business's (Store has no timezone column): it is
          changed in Profile → Business info, not Fees & Taxes. */}
      {shownTimezone ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {t("storeEssentials.marketSummary.changeTimezoneLater")}
        </p>
      ) : null}
    </section>
  );
}
