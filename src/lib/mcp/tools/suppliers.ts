import { z } from "zod";
import { SupplierOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadStoreAlerts } from "@/lib/services/store-alerts.service";
import {
  cancelSupplierOrder as cancelOrder,
  createSupplierOrder as createOrder,
  findSupplierOrderForReceipt,
  receiveSupplierOrder as receiveOrder,
  SupplierOrderError,
} from "@/lib/services/supplier-order.service";
import { defineStoreTool } from "../define-tool";
import { McpToolError } from "../errors";
import { baseCurrency, cursorArgs, num, page, pageInput, PAGES, storeIdInput } from "./shared";

const access = { pages: PAGES.catalog, feature: "supplierManagement" } as const;

export const listSuppliers = defineStoreTool({
  name: "list_suppliers",
  title: "Suppliers",
  description:
    "The store's suppliers with contact details and the materials each one supplies, with its price " +
    "per unit and whether it is the preferred supplier for that material.",
  input: z.object({ ...storeIdInput, search: z.string().max(100).optional(), ...pageInput }),
  kind: "read",
  access,
  handler: async (input, ctx) => {
    const money$ = await baseCurrency(ctx.storeId);
    const rows = await prisma.supplier.findMany({
      where: {
        storeId: ctx.storeId,
        ...(input.search && { name: { contains: input.search, mode: "insensitive" as const } }),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...cursorArgs(input.cursor),
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        city: true,
        materialSuppliers: {
          select: {
            price: true,
            isPreferred: true,
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
    const { items, nextCursor } = page(rows, input.limit);
    return {
      currency: money$.currency,
      suppliers: items.map((s) => ({
        supplierId: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        email: s.email,
        phone: s.phone,
        city: s.city,
        materials: s.materialSuppliers.map((ms) => ({
          materialId: ms.material.id,
          name: ms.material.name,
          unit: ms.material.unit,
          pricePerUnit: money$.convert(ms.price),
          preferred: ms.isPreferred,
        })),
      })),
      nextCursor,
    };
  },
});

const ORDER_STATUSES = Object.values(SupplierOrderStatus) as [
  SupplierOrderStatus,
  ...SupplierOrderStatus[],
];

export const listSupplierOrders = defineStoreTool({
  name: "list_supplier_orders",
  title: "Supplier orders",
  description:
    "Orders placed with suppliers, newest first: status (PLACED = open, waiting for delivery; RECEIVED; " +
    "CANCELLED; PENDING only on old orders), expected and received dates, lines and total. Use open: " +
    "true for what is still on its way.",
  input: z.object({
    ...storeIdInput,
    open: z.boolean().optional().describe("Only orders not yet received or cancelled."),
    status: z.enum(ORDER_STATUSES).optional(),
    ...pageInput,
  }),
  kind: "read",
  access,
  handler: async (input, ctx) => {
    const money$ = await baseCurrency(ctx.storeId);
    const rows = await prisma.supplierOrder.findMany({
      where: {
        storeId: ctx.storeId,
        ...(input.open ? { status: { in: ["PENDING", "PLACED"] } } : {}),
        ...(input.status && { status: input.status }),
      },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...cursorArgs(input.cursor),
      include: {
        supplier: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            unit: true,
            unitPrice: true,
            material: { select: { name: true } },
          },
        },
      },
    });
    const { items, nextCursor } = page(rows, input.limit);
    const today = new Date().toISOString().slice(0, 10);
    return {
      currency: money$.currency,
      orders: items.map((o) => {
        const expected = o.expectedDate?.toISOString().slice(0, 10) ?? null;
        const isOpen = o.status === "PLACED" || o.status === "PENDING";
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          supplier: o.supplier.name,
          status: o.status,
          ordered: o.orderDate.toISOString().slice(0, 10),
          expected,
          late: isOpen && expected !== null && expected < today,
          received: o.receivedDate?.toISOString().slice(0, 10) ?? null,
          lines: o.items.map((line) => ({
            material: line.material.name,
            quantity: num(line.quantity),
            unit: line.unit,
            unitPrice: money$.convert(line.unitPrice),
          })),
          total: money$.convert(o.total),
          notes: o.notes,
        };
      }),
      nextCursor,
    };
  },
});

export const proposeSupplierOrder = defineStoreTool({
  name: "propose_supplier_order",
  title: "Propose supplier orders",
  description:
    "A proposed restock, grouped by supplier, for everything low or oversold (the same list as " +
    "get_stock_alerts). Each line orders back up to the material's max stock, or twice its reorder level " +
    "when no max is set, from its preferred supplier (else the cheapest), at that supplier's price. " +
    "Writes nothing: show it, let the person adjust, then call create_supplier_order per supplier.",
  input: z.object({ ...storeIdInput }),
  kind: "read",
  access,
  handler: async (_input, ctx) => {
    const [{ lowStock }, money$] = await Promise.all([
      loadStoreAlerts(ctx.storeId),
      baseCurrency(ctx.storeId),
    ]);
    const maxStock = await prisma.material.findMany({
      where: { id: { in: lowStock.map((a) => a.materialId) } },
      select: { id: true, maxStock: true },
    });
    const maxById = new Map(maxStock.map((m) => [m.id, num(m.maxStock)]));

    const bySupplier = new Map<
      string,
      {
        supplierId: string;
        supplier: string;
        lines: Array<Record<string, unknown>>;
        totalBase: number;
      }
    >();
    const noSupplier: Array<{
      materialId: string;
      name: string;
      suggestedQuantity: number;
      unit: string;
    }> = [];

    for (const alert of lowStock) {
      const current = num(alert.currentStock);
      const reorder = num(alert.minStock);
      const target =
        (maxById.get(alert.materialId) ?? 0) > 0 ? maxById.get(alert.materialId)! : reorder * 2;
      const quantity = Math.ceil(Math.max(target - current, reorder > 0 ? reorder : 1) * 100) / 100;

      const supplier =
        alert.suppliers.find((s) => s.isPreferred) ??
        [...alert.suppliers].sort((a, b) => num(a.price) - num(b.price))[0];
      if (!supplier) {
        noSupplier.push({
          materialId: alert.materialId,
          name: alert.materialName,
          suggestedQuantity: quantity,
          unit: alert.unit,
        });
        continue;
      }
      const group = bySupplier.get(supplier.id) ?? {
        supplierId: supplier.id,
        supplier: supplier.name,
        lines: [],
        totalBase: 0,
      };
      group.lines.push({
        materialId: alert.materialId,
        name: alert.materialName,
        currentStock: current,
        reorderLevel: reorder,
        quantity,
        unit: alert.unit,
        unitPrice: money$.convert(supplier.price),
        lineTotal: money$.convert(quantity * num(supplier.price)),
      });
      group.totalBase += quantity * num(supplier.price);
      bySupplier.set(supplier.id, group);
    }

    return {
      currency: money$.currency,
      proposals: [...bySupplier.values()].map(({ totalBase, ...group }) => ({
        ...group,
        estimatedTotal: money$.convert(totalBase),
      })),
      noSupplierLinked: noSupplier,
      note: lowStock.length === 0 ? "Nothing is low right now." : undefined,
    };
  },
});

export const createSupplierOrder = defineStoreTool({
  name: "create_supplier_order",
  title: "Place a supplier order",
  description:
    "Place one order with one supplier (it is created as PLACED: there is no draft stage). Quantities " +
    "are in each material's unit; unitPrice is in the store's currency and defaults to that supplier's " +
    "price for the material. Nothing is sent to the supplier from here — tell the person to send it from " +
    "the Reorder panel in Epidom or contact the supplier. Stock goes up only when the order is received.",
  input: z.object({
    ...storeIdInput,
    supplierId: z.string(),
    items: z
      .array(
        z.object({
          materialId: z.string(),
          quantity: z.number().positive(),
          unitPrice: z
            .number()
            .min(0)
            .optional()
            .describe("Store currency, per unit. Omit to use the supplier's price."),
        })
      )
      .min(1)
      .max(50),
    expectedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("When delivery is expected, YYYY-MM-DD."),
    notes: z.string().max(500).optional(),
  }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const money$ = await baseCurrency(ctx.storeId);
    const links = await prisma.materialSupplier.findMany({
      where: {
        supplierId: input.supplierId,
        materialId: { in: input.items.map((i) => i.materialId) },
      },
      select: { materialId: true, price: true },
    });
    const linkPrice = new Map(links.map((l) => [l.materialId, l.price]));

    const items = input.items.map((item) => {
      const unitPrice =
        item.unitPrice !== undefined
          ? money$.toBase(item.unitPrice)
          : linkPrice.get(item.materialId);
      if (unitPrice === undefined) {
        throw new McpToolError(
          "PRICE_REQUIRED",
          `This supplier has no price for material ${item.materialId}: give a unitPrice.`
        );
      }
      return { materialId: item.materialId, quantity: item.quantity, unitPrice };
    });

    try {
      const order = await createOrder(ctx.storeId, {
        supplierId: input.supplierId,
        items,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
      });
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        supplier: order.supplier.name,
        currency: money$.currency,
        total: money$.convert(order.total),
        lines: order.items.map((line) => ({
          material: line.material.name,
          quantity: num(line.quantity),
          unit: line.unit,
          unitPrice: money$.convert(line.unitPrice),
        })),
      };
    } catch (error) {
      if (error instanceof SupplierOrderError) {
        throw new McpToolError(
          "NOT_FOUND",
          error.code === "SUPPLIER_NOT_FOUND"
            ? "No such supplier in this store. Use list_suppliers."
            : `${error.message} in this store. Use list_inventory.`
        );
      }
      throw error;
    }
  },
});

export const receiveSupplierOrder = defineStoreTool({
  name: "receive_supplier_order",
  title: "Mark a supplier order received",
  description:
    "Record that a supplier order was delivered: adds every line to stock (one PURCHASE movement each) " +
    "and marks the order RECEIVED. Do this only when the person confirms the goods arrived. It can't be " +
    "undone from here; a wrong delivery is corrected with adjust_stock.",
  input: z.object({ ...storeIdInput, orderId: z.string() }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    const order = await findSupplierOrderForReceipt(ctx.storeId, input.orderId);
    if (!order) throw new McpToolError("NOT_FOUND", "No such supplier order in this store.");
    if (order.status === "RECEIVED") {
      throw new McpToolError(
        "ALREADY_RECEIVED",
        "This order is already received; its stock was added then."
      );
    }
    if (order.status === "CANCELLED") {
      throw new McpToolError("CANCELLED", "This order was cancelled. Place a new order instead.");
    }
    const claimed = await receiveOrder(ctx.storeId, order);
    if (!claimed) {
      throw new McpToolError("ALREADY_RECEIVED", "Someone else just marked this order received.");
    }
    return {
      orderNumber: order.orderNumber,
      status: "RECEIVED",
      added: order.items.map((line) => ({
        material: line.material.name,
        quantity: num(line.quantity),
        unit: line.unit,
      })),
    };
  },
});

export const cancelSupplierOrder = defineStoreTool({
  name: "cancel_supplier_order",
  title: "Cancel a supplier order",
  description:
    "Cancel an open supplier order (it stays in the history as CANCELLED). A received order can't be " +
    "cancelled. This doesn't tell the supplier: say so to the person.",
  input: z.object({ ...storeIdInput, orderId: z.string() }),
  kind: "write",
  access,
  hints: { destructiveHint: true, idempotentHint: true },
  handler: async (input, ctx) => {
    const outcome = await cancelOrder(ctx.storeId, input.orderId);
    if (outcome === "not_found")
      throw new McpToolError("NOT_FOUND", "No such supplier order in this store.");
    if (outcome === "received") {
      throw new McpToolError("RECEIVED", "This order was received, so it can't be cancelled.");
    }
    return { orderId: input.orderId, status: "CANCELLED" };
  },
});
