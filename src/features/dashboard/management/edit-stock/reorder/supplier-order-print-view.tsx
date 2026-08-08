"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";

interface SupplierOrderPrintItem {
  materialName: string;
  materialSku: string | null;
  quantity: number;
  unit: string;
  unitPriceFormatted: string;
  totalFormatted: string;
}

interface SupplierOrderPrintViewProps {
  storeName: string;
  orderNumber: string;
  orderDate: string;
  expectedDate: string | null;
  supplierName: string;
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
  orderNumber,
  orderDate,
  expectedDate,
  supplierName,
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

  return (
    <PrintReportShell
      title={`${t("management.delivery.title")} — ${orderNumber}`}
      storeName={storeName}
      generatedAt={generatedAt}
      subtitle={
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-semibold text-black">{supplierName}</p>
            {supplierAddress && <p>{supplierAddress}</p>}
            {supplierPhone && <p>{supplierPhone}</p>}
            {supplierEmail && <p>{supplierEmail}</p>}
          </div>
          <div className="text-right">
            <p>
              {t("management.delivery.orderDate") || "Order Date"}: {formatDate(orderDate)}
            </p>
            {expectedDate && (
              <p>
                {t("management.delivery.expectedDate") || "Expected"}: {formatDate(expectedDate)}
              </p>
            )}
          </div>
        </div>
      }
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase">
            <th className="py-2">{t("alerts.table.material")}</th>
            <th className="py-2 text-right">{t("alerts.quantity") || "Qty"}</th>
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
              <td className="py-2 text-right">{item.unitPriceFormatted}</td>
              <td className="py-2 text-right font-medium">{item.totalFormatted}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">{t("finance.subtotal") || "Subtotal"}</span>
          <span>{subtotalFormatted}</span>
        </div>
        {taxFormatted && (
          <div className="flex justify-between">
            <span className="text-gray-600">{t("finance.tax") || "Tax"}</span>
            <span>{taxFormatted}</span>
          </div>
        )}
        {shippingFormatted && (
          <div className="flex justify-between">
            <span className="text-gray-600">{t("finance.shipping") || "Shipping"}</span>
            <span>{shippingFormatted}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
          <span>{t("finance.total") || "Total"}</span>
          <span>{totalFormatted}</span>
        </div>
      </div>

      {notes && (
        <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-700">
          <p className="mb-1 font-semibold uppercase">{t("management.editStock.notes")}</p>
          <p>{notes}</p>
        </div>
      )}
    </PrintReportShell>
  );
}
