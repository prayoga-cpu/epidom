import { cn } from "@/lib/utils";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";
import { formatCurrency } from "@/lib/utils/formatting";
import {
  RECEIPT_INTL_LOCALE,
  RECEIPT_LABELS,
  RECEIPT_POWERED_BY_URL,
  resolveReceiptLocale,
} from "@/lib/receipts/receipt-labels";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";

interface ReceiptDocumentProps {
  data: ReceiptData;
  className?: string;
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-gray-300" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * Screen/print rendering of a receipt — the visual counterpart to
 * buildEscPos() in thermal-printer.ts. Both consume the same ReceiptData, so
 * the printed paper, the public /r/[orderId] page, and the receipt-settings
 * live preview never drift out of sync with each other.
 *
 * Deliberately a fixed white/black "paper" surface regardless of the app's
 * light/dark theme — it's emulating a physical printed artifact, not app UI.
 */
export function ReceiptDocument({ data, className }: ReceiptDocumentProps) {
  const locale = resolveReceiptLocale(data.locale);
  const labels = RECEIPT_LABELS[locale];
  const currency = data.currency ?? "IDR";
  const formatMoney = (amount: number) =>
    formatCurrency(amount, currency, RECEIPT_INTL_LOCALE[locale]);

  const social = [
    data.instagramHandle ? `IG @${data.instagramHandle}` : null,
    data.tiktokHandle ? `TikTok @${data.tiktokHandle}` : null,
    data.facebookHandle ? `FB ${data.facebookHandle}` : null,
  ].filter((s): s is string => !!s);

  const hasContactBlock = !!(data.address || data.email || data.phone || data.instagramHandle);

  return (
    <div
      className={cn(
        // print-report opts this out of the app-wide dark-mode text-color
        // override in globals.css (".dark .text-black/.text-gray-*" get
        // remapped to pale cream for readability against the dark theme —
        // exactly wrong for a receipt, which must always render as literal
        // black-on-white regardless of the active theme, like the other
        // print-report views (print-report-shell.tsx, order-history-print-view.tsx).
        "print-report mx-auto w-full max-w-sm rounded-sm bg-white p-6 font-mono text-xs text-black shadow-sm",
        className
      )}
    >
      <div className="text-center">
        <p className="text-base font-bold tracking-wide">{data.storeName}</p>
        {data.tagline && <p className="mt-0.5">{data.tagline}</p>}
      </div>

      {hasContactBlock && (
        <>
          <Divider />
          <div className="space-y-0.5 text-center">
            {data.address
              ?.split("\n")
              .map((line, i) => <p key={i}>{line}</p>)}
            {(data.email || data.phone) && (
              <p>{[data.email, data.phone].filter(Boolean).join("  ")}</p>
            )}
            {data.instagramHandle && <p>@{data.instagramHandle}</p>}
          </div>
        </>
      )}

      <Divider />
      <div className="space-y-0.5">
        <Row label={labels.billNo} value={data.orderNumber} />
        <Row label={labels.date} value={data.date} />
        {data.cashierName && <Row label={labels.cashier} value={data.cashierName} />}
        {data.tableLabel && <Row label={labels.table} value={data.tableLabel} />}
      </div>

      <Divider />
      <div className="flex justify-between font-semibold">
        <span>{labels.item}</span>
        <span>
          {labels.qty}&nbsp;&nbsp;&nbsp;{labels.total}
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {data.items.map((item, i) => (
          <div key={i}>
            <p>{item.name}</p>
            <div className="flex justify-between text-gray-600">
              <span>
                {item.quantity}x {formatMoney(item.unitPrice)}
              </span>
              <span>{formatMoney(item.total)}</span>
            </div>
            {item.optionNames && item.optionNames.length > 0 && (
              <p className="text-[11px] text-gray-500">{item.optionNames.join(", ")}</p>
            )}
            {item.notes && <p className="text-[11px] text-gray-500">* {item.notes}</p>}
          </div>
        ))}
      </div>

      <Divider />
      <div className="space-y-0.5">
        <Row label={labels.subtotal} value={formatMoney(data.subtotal)} />
        {!!data.tax && <Row label={data.taxLabel || labels.tax} value={formatMoney(data.tax)} />}
        {!!data.serviceCharge && (
          <Row
            label={data.serviceChargeLabel || labels.service}
            value={formatMoney(data.serviceCharge)}
          />
        )}
        {!!data.discountAmount && (
          <Row
            label={
              data.discountReason ? `${labels.discount} (${data.discountReason})` : labels.discount
            }
            value={`-${formatMoney(data.discountAmount)}`}
          />
        )}
      </div>

      <Divider />
      <div className="flex justify-between text-sm font-bold">
        <span>{labels.total}</span>
        <span>{formatMoney(data.total)}</span>
      </div>

      <Divider />
      <div className="space-y-0.5">
        {data.paymentMethod === "CASH" && data.amountTendered ? (
          <>
            <Row label={labels.cash} value={formatMoney(data.amountTendered)} />
            {data.change !== undefined && data.change >= 0 && (
              <Row label={labels.change} value={formatMoney(data.change)} />
            )}
          </>
        ) : (
          <Row label={`${labels.paidVia} (${data.paymentMethod})`} value={labels.paid} />
        )}
      </div>

      {data.notes && (
        <>
          <Divider />
          <p>
            {labels.notes}: {data.notes}
          </p>
        </>
      )}

      <Divider />
      <div className="text-center whitespace-pre-line">
        {data.footerMessage || labels.defaultFooter}
      </div>

      {social.length > 0 && (
        <>
          <Divider />
          <p className="text-center">{social.join(" · ")}</p>
        </>
      )}

      <Divider />
      <div className="flex items-center justify-center gap-1.5 text-gray-400">
        <EpidomMark size={14} />
        <p className="text-[11px]">
          {RECEIPT_POWERED_BY_URL} | {labels.poweredByTitle}
        </p>
      </div>
    </div>
  );
}
