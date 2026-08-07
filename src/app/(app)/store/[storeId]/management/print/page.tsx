import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { formatCurrency } from "@/lib/utils/formatting";
import { SupplierOrderPrintView } from "@/features/dashboard/management/edit-stock/reorder/supplier-order-print-view";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent. A standalone printable document, not
// a dashboard screen; still inherits I18nProvider/CurrencyProvider from the
// (app) layout above it.

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface PrintPageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SupplierOrderPrintPage({ params, searchParams }: PrintPageProps) {
  const { storeId } = await params;
  const sp = await searchParams;
  const orderId = firstParam(sp.orderId);

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);

  if (!orderId) {
    notFound();
  }

  const [order, business] = await Promise.all([
    prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
      include: { supplier: true, items: { include: { material: true } } },
    }),
    prisma.business.findUnique({ where: { id: store.businessId }, select: { currency: true } }),
  ]);

  if (!order) {
    notFound();
  }

  const currency = business?.currency ?? "IDR";

  return (
    <SupplierOrderPrintView
      storeName={store.name}
      orderNumber={order.orderNumber}
      orderDate={order.orderDate.toISOString()}
      expectedDate={order.expectedDate ? order.expectedDate.toISOString() : null}
      supplierName={order.supplier.name}
      supplierEmail={order.supplier.email}
      supplierPhone={order.supplier.phone}
      supplierAddress={
        [order.supplier.address, order.supplier.city, order.supplier.country]
          .filter(Boolean)
          .join(", ") || null
      }
      notes={order.notes}
      items={order.items.map((item) => ({
        materialName: item.material.name,
        materialSku: item.material.sku,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPriceFormatted: formatCurrency(Number(item.unitPrice), currency),
        totalFormatted: formatCurrency(Number(item.total), currency),
      }))}
      subtotalFormatted={formatCurrency(Number(order.subtotal), currency)}
      taxFormatted={Number(order.tax) > 0 ? formatCurrency(Number(order.tax), currency) : null}
      shippingFormatted={
        Number(order.shipping) > 0 ? formatCurrency(Number(order.shipping), currency) : null
      }
      totalFormatted={formatCurrency(Number(order.total), currency)}
      generatedAt={new Date().toISOString()}
    />
  );
}
