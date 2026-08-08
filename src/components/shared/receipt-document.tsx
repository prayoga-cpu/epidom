import { cn } from "@/lib/utils";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

interface ReceiptDocumentProps {
  data: ReceiptData;
  className?: string;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
        <Row label="No. Bill" value={data.orderNumber} />
        <Row label="Tanggal" value={data.date} />
        {data.cashierName && <Row label="Kasir" value={data.cashierName} />}
        {data.tableLabel && <Row label="Meja" value={data.tableLabel} />}
      </div>

      <Divider />
      <div className="flex justify-between font-semibold">
        <span>ITEM</span>
        <span>QTY&nbsp;&nbsp;&nbsp;TOTAL</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {data.items.map((item, i) => (
          <div key={i}>
            <p>{item.name}</p>
            <div className="flex justify-between text-gray-600">
              <span>
                {item.quantity}x Rp{formatMoney(item.unitPrice)}
              </span>
              <span>Rp{formatMoney(item.total)}</span>
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
        <Row label="SUBTOTAL" value={`Rp${formatMoney(data.subtotal)}`} />
        {!!data.tax && (
          <Row label={data.taxLabel || "Pajak"} value={`Rp${formatMoney(data.tax)}`} />
        )}
        {!!data.serviceCharge && (
          <Row
            label={data.serviceChargeLabel || "Service"}
            value={`Rp${formatMoney(data.serviceCharge)}`}
          />
        )}
        {!!data.discountAmount && (
          <Row
            label={data.discountReason ? `Diskon (${data.discountReason})` : "Diskon"}
            value={`-Rp${formatMoney(data.discountAmount)}`}
          />
        )}
      </div>

      <Divider />
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>Rp{formatMoney(data.total)}</span>
      </div>

      <Divider />
      <div className="space-y-0.5">
        {data.paymentMethod === "CASH" && data.amountTendered ? (
          <>
            <Row label="TUNAI" value={`Rp${formatMoney(data.amountTendered)}`} />
            {data.change !== undefined && data.change >= 0 && (
              <Row label="KEMBALI" value={`Rp${formatMoney(data.change)}`} />
            )}
          </>
        ) : (
          <Row label={`Bayar (${data.paymentMethod})`} value="LUNAS" />
        )}
      </div>

      {data.notes && (
        <>
          <Divider />
          <p>Catatan: {data.notes}</p>
        </>
      )}

      <Divider />
      <div className="text-center whitespace-pre-line">
        {data.footerMessage || "Terima kasih!\nSilakan datang kembali"}
      </div>

      {social.length > 0 && (
        <>
          <Divider />
          <p className="text-center">{social.join(" · ")}</p>
        </>
      )}

      <Divider />
      <p className="text-center text-[11px] text-gray-400">epidom.app</p>
    </div>
  );
}
