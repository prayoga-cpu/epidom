"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";

interface SupplierOrderPrintItem {
  materialName: string;
  materialSku: string | null;
  quantity: number;
  unit: string;
  /** Requested DLC for this line, ISO string, or null when not applicable. */
  expiryDate: string | null;
  unitPriceFormatted: string;
  totalFormatted: string;
}

interface SupplierOrderPrintViewProps {
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  storeEmail: string | null;
  orderNumber: string;
  orderDate: string;
  expectedDate: string | null;
  /** PENDING | PLACED | RECEIVED | CANCELLED — printed so a re-print isn't mistaken for a new order. */
  status: string;
  supplierName: string;
  supplierContactPerson: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierAddress: string | null;
  notes: string | null;
  items: SupplierOrderPrintItem[];
  subtotalFormatted: string;
  taxFormatted: string | null;
  shippingFormatted: string | null;
  totalFormatted: string;
  generatedAt: string;
}

export function SupplierOrderPrintView({
  storeName,
  storeAddress,
  storePhone,
  storeEmail,
  orderNumber,
  orderDate,
  expectedDate,
  status,
  supplierName,
  supplierContactPerson,
  supplierEmail,
  supplierPhone,
  supplierAddress,
  notes,
  items,
  subtotalFormatted,
  taxFormatted,
  shippingFormatted,
  totalFormatted,
  generatedAt,
}: SupplierOrderPrintViewProps) {
  const { t, formatDate } = useI18n();

  const storeContactLines = [storeAddress, storePhone, storeEmail].filter(
    (line): line is string => !!line
  );

  const statusLabel =
    {
      PENDING: t("management.delivery.status.pending"),
      PLACED: t("management.delivery.status.inTransit"),
      RECEIVED: t("management.delivery.status.received"),
      CANCELLED: t("management.delivery.status.cancelled"),
    }[status] ?? status;

  // Only print the DLC column when at least one line carries one — a dry
  // goods order shouldn't show an empty column.
  const hasExpiryDates = items.some((item) => item.expiryDate);

  return (
    <PrintReportShell
      title={`${t("management.delivery.quoteTitle")} — ${orderNumber}`}
      storeName={storeName}
      storeContactLines={storeContactLines}
      generatedAt={generatedAt}
      subtitle={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-gray-600 uppercase">
              {t("management.delivery.table.supplier")}
            </p>
            <p className="font-semibold text-black">{supplierName}</p>
            {supplierContactPerson && <p>{supplierContactPerson}</p>}
            {supplierAddress && <p>{supplierAddress}</p>}
            {supplierPhone && <p>{supplierPhone}</p>}
            {supplierEmail && <p>{supplierEmail}</p>}
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-gray-600 uppercase">
              {t("management.delivery.quoteTitle")}
            </p>
            <p className="font-semibold text-black">{orderNumber}</p>
            <p>
              {t("management.delivery.orderDate")}: {formatDate(orderDate)}
            </p>
            {expectedDate && (
              <p>
                {t("management.delivery.expectedDate")}: {formatDate(expectedDate)}
              </p>
            )}
            <p>
              {/* NOT `common.status` — that key holds an object
                  ({ Active, Canceled, Trial }), and t() returns the key
                  itself for anything that isn't a string or number, so the
                  quote printed the literal "common.status". */}
              {t("management.delivery.table.status")}: {statusLabel}
            </p>
          </div>
        </div>
      }
    >
      {/* Wide by nature — scrolls on screen rather than overflowing the page. */}
      <div className="-mx-4 overflow-x-auto sm:mx-0 print:mx-0 print:overflow-visible">
        <table className="w-full min-w-[520px] border-collapse text-sm print:min-w-0">
          <thead>
            <tr className="border-b-2 border-black text-left text-xs uppercase">
              <th className="py-2">{t("alerts.table.material")}</th>
              <th className="py-2 text-right">{t("alerts.quantity")}</th>
              {hasExpiryDates && (
                <th className="py-2 text-right">{t("management.delivery.dlc")}</th>
              )}
              <th className="py-2 text-right">{t("alerts.price")}</th>
              <th className="py-2 text-right">{t("alerts.total")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2">
                  {item.materialName}
                  {item.materialSku && (
                    <span className="ml-2 text-xs text-gray-500">({item.materialSku})</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {item.quantity} {item.unit}
                </td>
                {hasExpiryDates && (
                  <td className="py-2 text-right">
                    {item.expiryDate ? formatDate(item.expiryDate) : "—"}
                  </td>
                )}
                <td className="py-2 text-right">{item.unitPriceFormatted}</td>
                <td className="py-2 text-right font-medium">{item.totalFormatted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">{t("finance.subtotal")}</span>
          <span>{subtotalFormatted}</span>
        </div>
        {taxFormatted && (
          <div className="flex justify-between">
            <span className="text-gray-600">{t("finance.tax")}</span>
            <span>{taxFormatted}</span>
          </div>
        )}
        {shippingFormatted && (
          <div className="flex justify-between">
            <span className="text-gray-600">{t("finance.shipping")}</span>
            <span>{shippingFormatted}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
          <span>{t("finance.total")}</span>
          <span>{totalFormatted}</span>
        </div>
      </div>

      {notes && (
        <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-700">
          <p className="mb-1 font-semibold uppercase">{t("management.editStock.notes")}</p>
          <p>{notes}</p>
        </div>
      )}

      {hasExpiryDates && (
        <p className="mt-4 text-xs text-gray-700">{t("management.delivery.dlcNotice")}</p>
      )}

      {/* Signature strip — a quote a supplier signs back is the point of printing it. */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-gray-700">
        <div>
          <p className="mb-8">{t("management.delivery.signatureStore")}</p>
          <div className="border-t border-gray-400 pt-1">{storeName}</div>
        </div>
        <div>
          <p className="mb-8">{t("management.delivery.signatureSupplier")}</p>
          <div className="border-t border-gray-400 pt-1">{supplierName}</div>
        </div>
      </div>
    </PrintReportShell>
  );
}
