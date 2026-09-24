"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { marketLabelKey } from "@/lib/finance/market-label";
import { formatCurrency, formatNumber } from "@/lib/utils/formatting";
import type { StoreOverview } from "@/types/api/store-overview";

interface StoreCardSummaryProps {
  /** This store's GET /api/stores/overview row; null/undefined while loading, on error, or when missing. */
  summary: StoreOverview | null | undefined;
  loading?: boolean;
  /**
   * False for a store this account works at as linked staff. The server
   * already sends no stats there; this is the client-side second guard.
   */
  showTotals: boolean;
}

/**
 * A store's money in the store's OWN currency, formatted exactly as
 * useCurrency().formatPrice prints it inside that store (formatCurrency with
 * "en-US"). Never useCurrency() here: on /stores there is no store, so the
 * provider holds the business currency and would mislabel or convert it.
 */
export function formatStoreMoney(value: number, currency: string): string {
  try {
    return formatCurrency(value, currency, "en-US");
  } catch {
    // A malformed stored code would make Intl throw.
    return `${currency} ${formatNumber(value, 2)}`;
  }
}

/**
 * The bottom of a /stores card: the storefront slogan, then a small grid of
 * figures. Totals (revenue, customers, staff) only for the owner's own stores;
 * market and currency for everyone. Plain phrasing and <dl> content, so it can
 * sit inside the card's link.
 */
export function StoreCardSummary({ summary, loading = false, showTotals }: StoreCardSummaryProps) {
  const { t, intlLocale } = useI18n();

  if (!summary) {
    if (!loading) return null;
    return (
      <div
        aria-hidden="true"
        data-testid="store-card-summary-skeleton"
        className="border-border mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3"
      >
        {Array.from({ length: showTotals ? 4 : 2 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  const totals = showTotals ? summary.stats : null;
  const count = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  return (
    <>
      {summary.tagline && (
        <p
          title={summary.tagline}
          className="text-muted-foreground line-clamp-2 text-xs leading-relaxed break-words sm:text-sm"
        >
          {summary.tagline}
        </p>
      )}
      <dl
        aria-label={t("stores.summary.title")}
        className="border-border mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3"
      >
        {totals && (
          <SummaryStat
            label={t("stores.summary.revenue")}
            hint={t("stores.summary.revenueHint")}
            value={formatStoreMoney(totals.revenue, summary.currency)}
          />
        )}
        {totals && (
          <SummaryStat label={t("stores.summary.customers")} value={count(totals.customerCount)} />
        )}
        {totals && totals.staffCount > 0 && (
          <SummaryStat label={t("stores.summary.staff")} value={count(totals.staffCount)} />
        )}
        <SummaryStat label={t("stores.summary.market")} value={t(marketLabelKey(summary.market))} />
        <SummaryStat label={t("stores.summary.currency")} value={summary.currency} />
      </dl>
    </>
  );
}

/**
 * One label/value pair. The revenue hint is a `title`, not a Tooltip: the
 * whole card body is a link, and a focusable tooltip trigger inside it would
 * be nested interactive content.
 */
function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt
        title={hint}
        className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase"
      >
        {label}
      </dt>
      <dd title={value} className="text-foreground truncate text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
