import { MovementType, WasteReason, type WasteEntry, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/utils/types.server";
import {
  resolveStockItem,
  applyStockDelta,
  type ResolvedStockItem,
} from "@/lib/services/stock-item.helpers";
import { fireLowStockAlertsForEntities } from "@/lib/services/stock-alerts.helpers";
import { publishStockChanged } from "@/lib/realtime/publish";
import { ValidationError } from "@/lib/errors";

/**
 * Waste Management Service
 *
 * Records inventory loss (expired/damaged/spoiled/...) against a Material or
 * Product, deducting stock and mirroring the loss into the append-only
 * StockMovement ledger (type: WASTE) for audit visibility alongside the
 * Movements tab and finance report.
 *
 * WasteEntry itself is mutable — corrections never rewrite the original
 * StockMovement, they append a compensating one (type: ADJUSTMENT, linked
 * via wasteEntryId) and update the WasteEntry row directly. Historical
 * `balanceAfter` snapshots on other movements are intentionally left as
 * recorded; only live currentStock is corrected going forward.
 */

export interface RecordWasteInput {
  storeId: string;
  materialId?: string;
  productId?: string;
  quantity: number;
  reason: WasteReason;
  customReason?: string;
  notes?: string;
  referenceId?: string;
}

export interface UpdateWasteInput {
  quantity?: number;
  reason?: WasteReason;
  customReason?: string;
  notes?: string;
  referenceId?: string;
  unitCostOverride?: number;
}

export interface WasteListFilters {
  from?: Date;
  to?: Date;
  materialId?: string;
  productId?: string;
  reason?: WasteReason;
  take?: number;
  skip?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function reasonLabel(reason: WasteReason, customReason?: string | null): string {
  return reason === WasteReason.OTHER && customReason ? customReason : reason;
}

/**
 * Realtime push (+ low-stock check for the paths that consume stock) for the
 * single Material or Product a waste path just moved.
 *
 * Always call this AFTER the `$transaction` promise resolves, never inside
 * the callback: a rolled-back waste entry must not tell every dashboard to
 * refetch a change that never landed. Neither call can throw, so a Pusher
 * outage or an alerting hiccup can't fail a committed stock write.
 */
async function notifyStockChanged(
  storeId: string,
  item: ResolvedStockItem,
  { checkLowStock }: { checkLowStock: boolean }
): Promise<void> {
  publishStockChanged(
    storeId,
    item.kind === "material" ? { materialIds: [item.id] } : { productIds: [item.id] }
  );

  if (checkLowStock) {
    await fireLowStockAlertsForEntities(storeId, [{ entityId: item.id, entityType: item.kind }]);
  }
}

class WasteService {
  async recordWaste(input: RecordWasteInput): Promise<{
    wasteEntry: WasteEntry;
    movement: Prisma.StockMovementGetPayload<object>;
  }> {
    if (input.reason === WasteReason.OTHER && !input.customReason?.trim()) {
      throw new ValidationError("Custom reason is required when reason is Other");
    }

    const item = await resolveStockItem(input.storeId, {
      materialId: input.materialId,
      productId: input.productId,
    });

    const newStock = item.currentStock - input.quantity;
    if (newStock < 0) {
      throw new Error("Stock cannot be negative");
    }

    const unitCostSnapshot = item.unitCost;
    const totalValue = round2(input.quantity * unitCostSnapshot);

    const result = await prisma.$transaction(
      async (tx) => {
        const wasteEntry = await tx.wasteEntry.create({
          data: {
            storeId: input.storeId,
            materialId: item.kind === "material" ? item.id : undefined,
            productId: item.kind === "product" ? item.id : undefined,
            quantity: toDecimal(input.quantity),
            unit: item.unit,
            reason: input.reason,
            customReason: input.customReason?.trim() || undefined,
            notes: input.notes || undefined,
            unitCostSnapshot: toDecimal(unitCostSnapshot),
            totalValue: toDecimal(totalValue),
            referenceId: input.referenceId || undefined,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            materialId: item.kind === "material" ? item.id : undefined,
            productId: item.kind === "product" ? item.id : undefined,
            type: MovementType.WASTE,
            quantity: toDecimal(-input.quantity),
            unit: item.unit,
            balanceAfter: toDecimal(newStock),
            notes: input.notes || undefined,
            reason: reasonLabel(input.reason, input.customReason),
            referenceId: input.referenceId || undefined,
            wasteEntryId: wasteEntry.id,
          },
        });

        await applyStockDelta(tx, item, newStock);

        return { wasteEntry, movement };
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }
    );

    // Waste always consumes stock, so this is the one path that can drop an
    // item under its minimum — same alert a sale raises.
    await notifyStockChanged(input.storeId, item, { checkLowStock: true });

    return result;
  }

  async updateWasteEntry(
    storeId: string,
    wasteEntryId: string,
    input: UpdateWasteInput
  ): Promise<{ wasteEntry: WasteEntry; movement: Prisma.StockMovementGetPayload<object> | null }> {
    const existing = await prisma.wasteEntry.findFirst({
      where: { id: wasteEntryId, storeId },
    });
    if (!existing) {
      throw new Error("Waste entry not found");
    }

    const nextReason = input.reason ?? existing.reason;
    const nextCustomReason =
      input.customReason !== undefined ? input.customReason : existing.customReason;
    if (nextReason === WasteReason.OTHER && !nextCustomReason?.trim()) {
      throw new ValidationError("Custom reason is required when reason is Other");
    }

    const item = await resolveStockItem(storeId, {
      materialId: existing.materialId ?? undefined,
      productId: existing.productId ?? undefined,
    });

    const oldQuantity = Number(existing.quantity);
    const newQuantity = input.quantity ?? oldQuantity;
    const newUnitCost = input.unitCostOverride ?? Number(existing.unitCostSnapshot);
    const newTotalValue = round2(newQuantity * newUnitCost);

    // Positive stockDelta = stock given back (waste quantity reduced),
    // negative = more stock consumed (waste quantity increased).
    const stockDelta = oldQuantity - newQuantity;
    const newCurrentStock = item.currentStock + stockDelta;

    if (newCurrentStock < 0) {
      throw new Error(
        "Cannot apply this correction: it would drive current stock negative. " +
          "Other stock movements have happened since this waste entry was recorded."
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        let movement: Prisma.StockMovementGetPayload<object> | null = null;

        if (stockDelta !== 0) {
          movement = await tx.stockMovement.create({
            data: {
              materialId: item.kind === "material" ? item.id : undefined,
              productId: item.kind === "product" ? item.id : undefined,
              type: MovementType.ADJUSTMENT,
              quantity: toDecimal(stockDelta),
              unit: item.unit,
              balanceAfter: toDecimal(newCurrentStock),
              notes: `Correction for waste entry ${existing.id}: quantity ${oldQuantity} → ${newQuantity}`,
              reason: reasonLabel(nextReason, nextCustomReason),
              wasteEntryId: existing.id,
            },
          });

          await applyStockDelta(tx, item, newCurrentStock);
        }

        const wasteEntry = await tx.wasteEntry.update({
          where: { id: existing.id },
          data: {
            quantity: toDecimal(newQuantity),
            reason: nextReason,
            customReason: nextCustomReason?.trim() || null,
            notes: input.notes !== undefined ? input.notes || null : undefined,
            referenceId: input.referenceId !== undefined ? input.referenceId || null : undefined,
            unitCostSnapshot: toDecimal(newUnitCost),
            totalValue: toDecimal(newTotalValue),
          },
        });

        return { wasteEntry, movement };
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }
    );

    // A metadata-only correction (same quantity) moved no stock, so there is
    // nothing for the stock views to refetch. A correction that *increased*
    // the wasted quantity (stockDelta < 0) consumed more and can cross the
    // minimum; one that gave stock back can't.
    if (stockDelta !== 0) {
      await notifyStockChanged(storeId, item, { checkLowStock: stockDelta < 0 });
    }

    return result;
  }

  async deleteWasteEntry(storeId: string, wasteEntryId: string): Promise<{ success: true }> {
    const existing = await prisma.wasteEntry.findFirst({
      where: { id: wasteEntryId, storeId },
    });
    if (!existing) {
      throw new Error("Waste entry not found");
    }

    const item = await resolveStockItem(storeId, {
      materialId: existing.materialId ?? undefined,
      productId: existing.productId ?? undefined,
    });

    const restoredQuantity = Number(existing.quantity);
    const newCurrentStock = item.currentStock + restoredQuantity;

    await prisma.$transaction(
      async (tx) => {
        await tx.stockMovement.create({
          data: {
            materialId: item.kind === "material" ? item.id : undefined,
            productId: item.kind === "product" ? item.id : undefined,
            type: MovementType.ADJUSTMENT,
            quantity: toDecimal(restoredQuantity),
            unit: item.unit,
            balanceAfter: toDecimal(newCurrentStock),
            notes: `Reversal: waste entry ${existing.id} deleted`,
            wasteEntryId: existing.id,
          },
        });

        await applyStockDelta(tx, item, newCurrentStock);

        // Linked StockMovement rows keep their wasteEntryId set to NULL
        // (onDelete: SetNull) — the ledger stays intact, just orphaned.
        await tx.wasteEntry.delete({ where: { id: existing.id } });
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }
    );

    // Deleting a waste entry credits the stock back — push, but no low-stock
    // check: nothing can drop below its minimum by going up.
    await notifyStockChanged(storeId, item, { checkLowStock: false });

    return { success: true };
  }

  async getWasteEntryById(storeId: string, wasteEntryId: string) {
    return prisma.wasteEntry.findFirst({
      where: { id: wasteEntryId, storeId },
      include: {
        material: { select: { id: true, name: true, sku: true, unit: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
      },
    });
  }

  async listWasteEntries(storeId: string, filters: WasteListFilters = {}) {
    const where: Prisma.WasteEntryWhereInput = {
      storeId,
      materialId: filters.materialId,
      productId: filters.productId,
      reason: filters.reason,
      createdAt:
        filters.from || filters.to
          ? { gte: filters.from, lte: filters.to }
          : undefined,
    };

    const [entries, total, sum] = await Promise.all([
      prisma.wasteEntry.findMany({
        where,
        include: {
          material: { select: { id: true, name: true, sku: true, unit: true } },
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
        take: filters.take ?? 50,
        skip: filters.skip ?? 0,
      }),
      prisma.wasteEntry.count({ where }),
      prisma.wasteEntry.aggregate({ where, _sum: { totalValue: true } }),
    ]);

    return {
      entries,
      total,
      sumValue: Number(sum._sum.totalValue ?? 0),
    };
  }
}

export const wasteService = new WasteService();
