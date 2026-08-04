import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { buildOrderHistoryWhere } from "@/lib/services/order-history-query";
import { serializePosOrders } from "@/lib/server/serialize";
import { OrderHistoryPrintView } from "@/features/pos/components/order-history-print-view";

// Deliberately outside the (dashboard) route group so it doesn't inherit
// PageShell's sidebar/topbar chrome — this route is a standalone printable
// document, not a dashboard screen. It still inherits I18nProvider and
// CurrencyProvider from the (app) layout above it.

const PRINT_ROW_CAP = 2000;

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface PrintPageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrderHistoryPrintPage({ params, searchParams }: PrintPageProps) {
  const { storeId } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);

  const business = await prisma.business.findUnique({
    where: { id: store.businessId },
    select: { name: true, user: { select: { name: true, email: true } } },
  });

  const status = firstParam(sp.status);
  const source = firstParam(sp.source);
  const from = firstParam(sp.from);
  const to = firstParam(sp.to);
  const q = firstParam(sp.q);
  const unpaid = firstParam(sp.unpaid) === "1";
  const productId = firstParam(sp.productId);
  const department = firstParam(sp.department);
  const staffId = firstParam(sp.staffId);

  const where = buildOrderHistoryWhere(storeId, {
    status,
    source,
    from,
    to,
    q,
    unpaid,
    productId,
    department,
    staffId,
  });

  // Resolve names for the filters-applied summary — the report only has IDs
  // from the URL, not the labels the History tab's dropdowns showed.
  const [productLabel, staffLabel] = await Promise.all([
    productId
      ? prisma.menuItem.findUnique({ where: { id: productId }, select: { name: true } })
      : null,
    staffId
      ? prisma.staffMember.findUnique({ where: { id: staffId }, select: { name: true } })
      : null,
  ]);

  const [rows, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      take: PRINT_ROW_CAP,
      include: {
        table: { select: { label: true } },
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            total: true,
            menuItem: { select: { name: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return (
    <OrderHistoryPrintView
      store={{
        name: store.name,
        address: store.address,
        city: store.city,
        country: store.country,
        phone: store.phone,
        email: store.email,
      }}
      account={{
        businessName: business?.name ?? "",
        ownerName: business?.user.name ?? "",
        ownerEmail: business?.user.email ?? "",
      }}
      orders={serializePosOrders(rows)}
      totalCount={totalCount}
      truncated={totalCount > rows.length}
      filters={{
        status,
        source,
        from,
        to,
        q,
        unpaidOnly: unpaid,
        productLabel: productLabel?.name ?? null,
        department,
        staffLabel: staffLabel?.name ?? null,
      }}
      generatedAt={new Date().toISOString()}
    />
  );
}
