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

  if (paymentMethod && (Object.values(PaymentMethod) as string[]).includes(paymentMethod)) {
    where.paymentMethod = paymentMethod as PaymentMethod;
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
    itemFilter.menuItem = { department: department as Department };
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
