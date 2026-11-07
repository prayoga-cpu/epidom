"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { formatCurrency } from "@/lib/utils/formatting";
import type { CurrencyTotals } from "@/lib/services/partner.service";

/** An amount stored in major units ("12.59") in its currency ("eur"). */
export function money(amount: string | number, currency: string, locale = "en-GB"): string {
  return formatCurrency(Number(amount), currency.toUpperCase(), locale);
}

export function shortDate(iso: string | null | undefined, locale = "en-GB"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  PAUSED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  ENDED: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useI18n();
  const key = `adminPages.partners.statuses.${status}`;
  const translated = t(key);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLES[status] ?? STATUS_STYLES.ENDED}`}
    >
      {label ?? (translated && translated !== key ? translated : status.toLowerCase())}
    </span>
  );
}

/** Commission per currency: on hold, ready to pay, paid. Currencies are never added together. */
export function CurrencyTotalsList({
  totals,
  labels,
  locale,
  empty,
}: {
  totals: CurrencyTotals[];
  labels?: { onHold: string; ready: string; paid: string };
  locale?: string;
  empty?: string;
}) {
  // The partner's own page passes its labels; the admin pages use these.
  const { t, intlLocale } = useI18n();
  labels ??= {
    onHold: t("adminPages.partners.totals.onHold"),
    ready: t("adminPages.partners.totals.ready"),
    paid: t("adminPages.partners.totals.paid"),
  };
  locale ??= intlLocale;
  empty ??= t("adminPages.partners.totals.empty");
  if (totals.length === 0) return <p className="text-muted-foreground text-xs">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {totals.map((t) => (
        <div key={t.currency} className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">{labels.onHold}</p>
            <p className="text-foreground font-semibold tabular-nums">
              {money(t.onHold, t.currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{labels.ready}</p>
            <p className="font-semibold text-emerald-400 tabular-nums">
              {money(t.ready, t.currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{labels.paid}</p>
            <p className="text-foreground font-semibold tabular-nums">
              {money(t.paid, t.currency, locale)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
