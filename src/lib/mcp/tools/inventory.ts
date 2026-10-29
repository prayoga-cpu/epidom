import { z } from "zod";
import { MovementType, WasteReason, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadStoreAlerts } from "@/lib/services/store-alerts.service";
import { adjustStockRecorded } from "@/lib/services/stock-adjust.service";
import { wasteService } from "@/lib/services/waste.service";
import { defineStoreTool } from "../define-tool";
import { relayKnownError, STOCK_ITEM_ERRORS } from "../errors";
import { periodInput, resolveRange } from "../range";
import {
  baseCurrency,
  cursorArgs,
  money,
  num,
  page,
  pageInput,
  PAGES,
  storeIdInput,
  storeTimezone,
} from "./shared";

const baseToStore = baseCurrency;

export const getStockAlerts = defineStoreTool({
  name: "get_stock_alerts",
  title: "Low stock and unpaid tabs",
  description:
    "What needs attention now, exactly as the Alerts page shows it: materials that are oversold (below " +
    "zero) or at or below their reorder level, most urgent first, each with its suppliers and their " +
    "price per purchase unit; and Pay Later orders still unpaid. Use propose_supplier_order to turn the " +
    "low stock into orders.",
  input: z.object({ ...storeIdInput }),
  kind: "read",
  access: { pages: PAGES.inventory },
  handler: async (_input, ctx) => {
    const [{ lowStock, unpaidOrders }, money$] = await Promise.all([
      loadStoreAlerts(ctx.storeId),
      baseToStore(ctx.storeId),
    ]);
    return {
      currency: money$.currency,
      lowStock: lowStock.map((alert) => ({
        materialId: alert.materialId,
        name: alert.materialName,
        sku: alert.materialSku,
        severity: alert.severity,
        oversold: alert.isNegativeStock,
        currentStock: num(alert.currentStock),
        reorderLevel: num(alert.minStock),
        unit: alert.unit,
        suppliers: alert.suppliers.map((s) => ({
          supplierId: s.id,
          name: s.name,
          price: money$.convert(s.price),
          preferred: s.isPreferred,
        })),
      })),
      unpaidPayLaterOrders: unpaidOrders.map((order) => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName || null,
        total: money(order.total),
        since: order.deliveredAt,
      })),
    };
  },
});

export const listInventory = defineStoreTool({
  name: "list_inventory",
  title: "Inventory",
  description:
    "Raw materials (ingredients, packaging) or finished products with their current stock, reorder " +
    "level, unit and cost; products also have their selling price. Search by name or SKU, or only those " +
    "at or below the reorder level. Ids here are what adjust_stock and record_waste take.",
  input: z.object({
    ...storeIdInput,
    type: z.enum(["materials", "products"]).default("materials"),
    search: z.string().max(100).optional(),
    lowOnly: z
      .boolean()
      .optional()
      .describe("Only items at or below their reorder level (or below zero)."),
    ...pageInput,
  }),
  kind: "read",
  access: { pages: PAGES.inventory },
  handler: async (input, ctx) => {
    const money$ = await baseToStore(ctx.storeId);
    const search = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { sku: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const low = (row: { currentStock: unknown; minStock: unknown }) =>
      num(row.currentStock) < 0 ||
      (num(row.minStock) > 0 && num(row.currentStock) <= num(row.minStock));

    if (input.type === "materials") {
      const rows = await prisma.material.findMany({
        where: { storeId: ctx.storeId, ...search },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        // lowOnly compares two columns, which Prisma can't express: filter
        // after reading, on a larger page.
        take: input.lowOnly ? 500 : input.limit + 1,
        ...(input.lowOnly ? {} : cursorArgs(input.cursor)),
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          unit: true,
          currentStock: true,
          minStock: true,
          maxStock: true,
          unitCost: true,
          expirationDate: true,
        },
      });
      const filtered = input.lowOnly ? rows.filter(low) : rows;
      const { items, nextCursor } = input.lowOnly
        ? { items: filtered.slice(0, 100), nextCursor: null }
        : page(filtered, input.limit);
      return {
        currency: money$.currency,
        type: "materials",
        items: items.map((m) => ({
          materialId: m.id,
          sku: m.sku,
          name: m.name,
          category: m.category,
          unit: m.unit,
          currentStock: num(m.currentStock),
          reorderLevel: num(m.minStock),
          maxStock: num(m.maxStock),
          unitCost: money$.convert(m.unitCost),
          expires: m.expirationDate?.toISOString().slice(0, 10) ?? null,
        })),
        nextCursor,
      };
    }

    const rows = await prisma.product.findMany({
      where: { storeId: ctx.storeId, ...search },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: input.lowOnly ? 500 : input.limit + 1,
      ...(input.lowOnly ? {} : cursorArgs(input.cursor)),
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
        minStock: true,
        stockMode: true,
        costPrice: true,
        sellingPrice: true,
      },
    });
    const filtered = input.lowOnly ? rows.filter(low) : rows;
    const { items, nextCursor } = input.lowOnly
      ? { items: filtered.slice(0, 100), nextCursor: null }
      : page(filtered, input.limit);
    return {
      currency: money$.currency,
      type: "products",
      items: items.map((p) => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stockMode: p.stockMode,
        currentStock: num(p.currentStock),
        reorderLevel: num(p.minStock),
        costPrice: money$.convert(p.costPrice),
        sellingPrice: money$.convert(p.sellingPrice),
      })),
      nextCursor,
    };
  },
});

const MOVEMENT_TYPES = Object.values(MovementType) as [MovementType, ...MovementType[]];

export const listStockMovements = defineStoreTool({
  name: "list_stock_movements",
  title: "Stock movements",
  description:
    "The stock ledger, newest first: every purchase, sale, production, waste and manual adjustment, " +
    "with the signed quantity and the balance after it. Filter by material or product, by type, and by " +
    "period.",
  input: z.object({
    ...storeIdInput,
    ...periodInput,
    materialId: z.string().optional(),
    productId: z.string().optional(),
    type: z.enum(MOVEMENT_TYPES).optional(),
    ...pageInput,
  }),
  kind: "read",
  access: { pages: PAGES.inventory },
  handler: async (input, ctx) => {
    const range = resolveRange(
      { ...input, period: input.period ?? "last_7_days" },
      await storeTimezone(ctx)
    );
    const where: Prisma.StockMovementWhereInput = {
      // A movement belongs to the store through its material or product.
      OR: [{ material: { storeId: ctx.storeId } }, { product: { storeId: ctx.storeId } }],
      createdAt: { gte: range.from, lte: range.to },
      ...(input.materialId && { materialId: input.materialId }),
      ...(input.productId && { productId: input.productId }),
      ...(input.type && { type: input.type }),
    };
    const rows = await prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...cursorArgs(input.cursor),
      select: {
        id: true,
        type: true,
        quantity: true,
        unit: true,
        balanceAfter: true,
        reason: true,
        notes: true,
        createdAt: true,
        material: { select: { name: true } },
        product: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    });
    const { items, nextCursor } = page(rows, input.limit);
    return {
      period: { firstDay: range.fromKey, lastDay: range.toKey, timezone: range.timezone },
      movements: items.map((m) => ({
        at: m.createdAt.toISOString(),
        item: m.material?.name ?? m.product?.name ?? null,
        type: m.type,
        quantity: num(m.quantity),
        unit: m.unit,
        balanceAfter: num(m.balanceAfter),
        reason: m.reason,
        notes: m.notes,
        order: m.order?.orderNumber ?? null,
      })),
      nextCursor,
    };
  },
});

export const adjustStock = defineStoreTool({
  name: "adjust_stock",
  title: "Adjust stock",
  description:
    "Add (IN) or remove (OUT) stock of one material or product by hand, e.g. after a stock count or a " +
    "delivery that wasn't ordered through Epidom. Writes a movement to the ledger and the Activity log. " +
    "Stock can't go below zero. For spoiled or damaged goods use record_waste instead, so it counts as " +
    "waste in the reports.",
  input: z.object({
    ...storeIdInput,
    materialId: z.string().optional(),
    productId: z.string().optional(),
    direction: z.enum(["IN", "OUT"]),
    quantity: z.number().positive().describe("In the item's own unit (see list_inventory)."),
    reason: z.string().trim().max(200).optional().describe("Why, e.g. 'Stock count 28 Oct'."),
  }),
  kind: "write",
  access: { pages: ["/management"] },
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    try {
      const result = await adjustStockRecorded(ctx.storeId, {
        materialId: input.materialId,
        productId: input.productId,
        adjustmentType: input.direction,
        quantity: input.quantity,
        reason: input.reason,
        notes: "Adjusted from Claude",
      });
      const item = result.material ?? result.product;
      return {
        item: item?.name,
        change: num(result.movement.quantity),
        stockNow: num(result.movement.balanceAfter),
        unit: item?.unit,
      };
    } catch (error) {
      relayKnownError(error, STOCK_ITEM_ERRORS);
    }
  },
});

const WASTE_REASONS = Object.values(WasteReason) as [WasteReason, ...WasteReason[]];

export const recordWaste = defineStoreTool({
  name: "record_waste",
  title: "Record waste",
  description:
    "Record stock thrown away (expired, damaged, spoiled, overproduction, quality control, other). Takes " +
    "it out of stock and counts its cost as waste in the finance reports.",
  input: z.object({
    ...storeIdInput,
    materialId: z.string().optional(),
    productId: z.string().optional(),
    quantity: z.number().positive(),
    reason: z.enum(WASTE_REASONS),
    customReason: z.string().max(200).optional().describe("Required wording when reason is OTHER."),
    notes: z.string().max(500).optional(),
  }),
  kind: "write",
  access: { pages: ["/management"] },
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    try {
      const result = await wasteService.recordWaste({
        storeId: ctx.storeId,
        materialId: input.materialId,
        productId: input.productId,
        quantity: input.quantity,
        reason: input.reason,
        customReason: input.customReason,
        notes: input.notes,
      });
      return {
        recorded: true,
        wasteEntryId: result.wasteEntry.id,
        stockNow: num(result.movement.balanceAfter),
        unit: result.wasteEntry.unit,
      };
    } catch (error) {
      relayKnownError(error, [
        [
          /custom reason is required/i,
          "INVALID_INPUT",
          "With reason OTHER, say what happened in customReason.",
        ],
        ...STOCK_ITEM_ERRORS,
      ]);
    }
  },
});
