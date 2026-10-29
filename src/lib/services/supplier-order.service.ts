import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishStockChanged } from "@/lib/realtime/publish";

/**
 * Supplier orders: create (which places them) and receive (which adds the
 * delivery to stock). Shared by the /supplier-orders routes and the Claude
 * connector so both write orders, stock and the ledger the same way.
 *
 * Money on a supplier order (unitPrice, subtotal, tax, shipping, total) is in
 * the platform base currency (IDR), like MaterialSupplier.price it is priced
 * from; the Reorder dialogs convert for display.
 */

export const SUPPLIER_ORDER_INCLUDE = {
  supplier: true,
  items: { include: { material: true } },
} satisfies Prisma.SupplierOrderInclude;

export type SupplierOrderErrorCode = "SUPPLIER_NOT_FOUND" | "MATERIAL_NOT_FOUND";

export class SupplierOrderError extends Error {
  constructor(
    readonly code: SupplierOrderErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SupplierOrderError";
  }
}

export interface CreateSupplierOrderInput {
  supplierId: string;
  items: Array<{
    materialId: string;
    quantity: Prisma.Decimal.Value;
    /** Base currency (IDR), per the material's unit. */
    unitPrice: Prisma.Decimal.Value;
    unit?: string | null;
    expiryDate?: string | Date | null;
  }>;
  expectedDate?: string | Date | null;
  notes?: string | null;
  tax?: Prisma.Decimal.Value | null;
  shipping?: Prisma.Decimal.Value | null;
}

/**
 * Create a supplier order, straight as PLACED: creating the order IS placing
 * it. There used to be a PENDING "Orders to Place" stage with a separate
 * "Mark as Placed" tap in between, which merchants skipped or forgot. PENDING
 * stays in the enum only so orders created before that change still read as
 * open.
 *
 * @throws SupplierOrderError when the supplier or a material isn't this store's.
 */
export async function createSupplierOrder(storeId: string, input: CreateSupplierOrderInput) {
  // Validate supplier existence (Business Logic)
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, storeId },
  });
  if (!supplier) {
    throw new SupplierOrderError(
      "SUPPLIER_NOT_FOUND",
      "Supplier not found or does not belong to this store"
    );
  }

  // Calculate totals and prepare items
  let subtotal = new Prisma.Decimal(0);
  const orderItems = [];

  for (const item of input.items) {
    const material = await prisma.material.findFirst({
      where: { id: item.materialId, storeId },
    });
    if (!material) {
      throw new SupplierOrderError("MATERIAL_NOT_FOUND", `Material ${item.materialId} not found`);
    }

    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const total = quantity.mul(unitPrice);

    subtotal = subtotal.add(total);

    orderItems.push({
      materialId: item.materialId,
      quantity,
      unit: item.unit || material.unit,
      unitPrice,
      total,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    });
  }

  const taxAmount = new Prisma.Decimal(input.tax || 0);
  const shippingAmount = new Prisma.Decimal(input.shipping || 0);
  const totalAmount = subtotal.add(taxAmount).add(shippingAmount);

  // Generate order number
  const orderCount = await prisma.supplierOrder.count({
    where: { storeId },
  });
  const orderNumber = `SO-${Date.now()}-${String(orderCount + 1).padStart(4, "0")}`;

  return prisma.supplierOrder.create({
    data: {
      storeId,
      supplierId: input.supplierId,
      orderNumber,
      status: "PLACED",
      orderDate: new Date(),
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      subtotal,
      tax: taxAmount,
      shipping: shippingAmount,
      total: totalAmount,
      notes: input.notes || null,
      items: {
        create: orderItems,
      },
    },
    include: SUPPLIER_ORDER_INCLUDE,
  });
}

/** An order with what receiving it needs: its lines and their materials. */
export function findSupplierOrderForReceipt(storeId: string, orderId: string) {
  return prisma.supplierOrder.findFirst({
    where: { id: orderId, storeId },
    include: { items: { include: { material: true } } },
  });
}

type OrderForReceipt = NonNullable<Awaited<ReturnType<typeof findSupplierOrderForReceipt>>>;

/**
 * Mark an order RECEIVED and add every line to stock, as one transaction.
 *
 * @returns false when another request received it first (nothing was added).
 */
export async function receiveSupplierOrder(
  storeId: string,
  existingOrder: Pick<OrderForReceipt, "id" | "orderNumber" | "items">,
  options: {
    expectedDate?: string | Date | null;
    receivedDate?: string | Date | null;
    notes?: string | null;
  } = {}
): Promise<boolean> {
  const orderId = existingOrder.id;
  const receivedAt = new Date();

  const claimed = await prisma.$transaction(async (tx) => {
    // Claim the transition first, conditionally. Receiving is one tap, so
    // a double tap (or two devices) sends two requests that both read the
    // order as not-yet-received above. Only the one whose update matches
    // goes on to add stock. The other adds nothing.
    const claim = await tx.supplierOrder.updateMany({
      where: { id: orderId, storeId, status: { not: "RECEIVED" } },
      data: {
        status: "RECEIVED",
        expectedDate: options.expectedDate ? new Date(options.expectedDate) : undefined,
        receivedDate: options.receivedDate ? new Date(options.receivedDate) : receivedAt,
        notes: options.notes !== undefined ? options.notes : undefined,
      },
    });
    if (claim.count === 0) return false;

    // Update material stock for each item
    for (const item of existingOrder.items) {
      // Carry the DLC agreed on the order line onto the material, so
      // receiving a delivery is the only place the merchant has to type
      // it. Material.expirationDate holds a single next-expiry date (not
      // one per lot), so among dates still in the future the soonest wins
      // — a batch expiring sooner must not be masked by a later one.
      //
      // The already-passed case has to be handled separately: nothing
      // clears this field when stock is consumed, so a material routinely
      // sits on an expired date from a lot that is long gone. A plain
      // "soonest wins" would reject every incoming DLC there (any future
      // date loses to a past one) and pin the material as expired
      // forever, with the Stock page still listing freshly delivered
      // goods under its "expired" filter.
      const currentExpiry = item.material.expirationDate;
      const shouldTakeExpiry =
        !!item.expiryDate &&
        (!currentExpiry || currentExpiry < receivedAt || item.expiryDate < currentExpiry);

      // increment, not "stock read above + quantity": a till sale that
      // moved this material since that read would otherwise be overwritten.
      const updated = await tx.material.update({
        where: { id: item.materialId },
        data: {
          currentStock: { increment: item.quantity },
          ...(shouldTakeExpiry && { expirationDate: item.expiryDate }),
        },
        select: { currentStock: true },
      });

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          materialId: item.materialId,
          type: "PURCHASE",
          quantity: item.quantity,
          unit: item.unit,
          balanceAfter: updated.currentStock,
          notes: `Supplier order ${existingOrder.orderNumber} received`,
        },
      });
    }

    return true;
  });

  if (claimed) {
    // Receiving a delivery is the single most common way stock goes UP, and
    // it moved every material on the order — tell the other open views to
    // refetch. Published after the transaction resolves, never inside it, so
    // a rollback can't announce a restock that never happened.
    publishStockChanged(storeId, {
      materialIds: existingOrder.items.map((item) => item.materialId),
    });
  }
  return claimed;
}

/**
 * Cancel an open order (orders are never deleted). A received order can't be
 * cancelled: its delivery is already in stock.
 */
export async function cancelSupplierOrder(
  storeId: string,
  orderId: string
): Promise<"cancelled" | "not_found" | "received"> {
  const order = await prisma.supplierOrder.findFirst({
    where: { id: orderId, storeId },
  });
  if (!order) return "not_found";
  if (order.status === "RECEIVED") return "received";

  await prisma.supplierOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  return "cancelled";
}
