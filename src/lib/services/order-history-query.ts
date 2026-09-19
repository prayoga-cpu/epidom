import { Prisma, OrderStatus, OrderSource, PaymentMethod, Department } from "@prisma/client";

export interface OrderHistoryQueryParams {
  status?: string | null;
  source?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  unpaid?: boolean;
  productId?: string | null;
  department?: string | null;
  staffId?: string | null;
  paymentMethod?: string | null;
}

/**
 * Build the Prisma `where` clause for order history — shared by the paginated
 * GET /api/stores/[id]/orders route and the print-report page, so the two
 * can never drift on what counts as a match for a given filter set.
 */
export function buildOrderHistoryWhere(
  storeId: string,
  {
    status,
    source,
    from,
    to,
    q,
    unpaid,
    productId,
    department,
    staffId,
    paymentMethod,
  }: OrderHistoryQueryParams
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { storeId };

  if (status && (Object.values(OrderStatus) as string[]).includes(status)) {
    where.status = status as OrderStatus;
  }

  if (source && (Object.values(OrderSource) as string[]).includes(source)) {
    where.source = source as OrderSource;
  }

  // Matches the whole-order method (single-tender orders, and everything
  // placed before OrderPayment existed) OR any one of the order's tenders, so
  // filtering by CASH still finds a bill that was settled half in cash and
  // half by card — whose `paymentMethod` is the literal "SPLIT".
  //
  // Wrapped in AND rather than spread as a bare `OR`: the free-text `q` filter
  // below already owns `where.OR`, and two OR keys in one object means the
  // second silently wins. SPLIT stays a legal value (it selects multi-tender
  // bills — no tender is ever SPLIT) even though the UI never offers it.
  if (paymentMethod && (Object.values(PaymentMethod) as string[]).includes(paymentMethod)) {
    where.AND = [
      {
        OR: [
          { paymentMethod: paymentMethod as PaymentMethod },
          { payments: { some: { method: paymentMethod as PaymentMethod } } },
        ],
      },
    ];
  }

  if (unpaid) {
    where.paymentStatus = "PENDING";
  }

  // Both narrow the same "which item" match — combined into one items.some so
  // a department filter alongside a product filter is consistent (the
  // product's own department always satisfies it) rather than potentially
  // requiring two different order items.
  const itemFilter: Prisma.OrderItemWhereInput = {};
  if (productId) itemFilter.menuItemId = productId;
  if (department && (Object.values(Department) as string[]).includes(department)) {
    // A Custom Item has no MenuItem at all (`menuItemId: null`) and carries its
    // prep area on `OrderItem.department` instead, so matching only through the
    // relation silently drops every custom line from a Kitchen/Bar filter —
    // the lines a cashier typed in by hand are exactly the ones they go looking
    // for. Both spellings of "this item belongs to that department" count.
    itemFilter.OR = [
      { menuItem: { department: department as Department } },
      { department: department as Department },
    ];
  }
  if (Object.keys(itemFilter).length > 0) {
    where.items = { some: itemFilter };
  }

  if (staffId) {
    where.shift = { staffMemberId: staffId };
  }

  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const orderDate: Prisma.DateTimeFilter = {};
    if (fromDate && !isNaN(fromDate.getTime())) orderDate.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) orderDate.lte = toDate;
    where.orderDate = orderDate;
  }

  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}
