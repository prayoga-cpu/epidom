import { prisma } from "@/lib/prisma";
import { MovementType, OrderItemStatus, StockMode } from "@prisma/client";
import type { Material, Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/utils/types.server";
import { convertUnit } from "@/lib/utils/unit-conversion";
import { publishStockChanged } from "@/lib/realtime/publish";
import { fireLowStockAlert } from "@/lib/services/stock-alerts.helpers";
import { primaryRecipeInclude, type PrimaryRecipe } from "@/lib/services/primary-recipe.helpers";
import { roundStock, roundsAwayToZero } from "@/lib/services/stock-precision";
import { runSerializable } from "@/lib/db/serializable";

/** Raw (unrounded) material requirement in the material's own unit, by materialId. */
type MaterialNeed = Map<string, number>;

export interface DeductResult {
  deducted: number;
  skipped: number;
  alreadyDeducted?: boolean;
  /**
   * BATCH_PRODUCED units sold beyond the counted balance, per product. Feeds the
   * ORDER_SHORTFALL settlement ledger so a later production log nets against it.
   */
  shortfalls?: { productId: string; quantity: number }[];
  /** Materials whose requirement rounds to 0.000 at Decimal(10,3) — nothing written. */
  belowPrecision?: string[];
}

function saleNote(orderNumber: string): string {
  return `Auto-deducted for order ${orderNumber}`;
}

/** Ids of SALE movements on this order that a RETURN has already reversed. */
async function reversedSaleIds(orderId: string): Promise<string[]> {
  const returns = await prisma.stockMovement.findMany({
    where: { orderId, type: MovementType.RETURN, reversesMovementId: { not: null } },
    select: { reversesMovementId: true },
  });
  return returns
    .map((r) => r.reversesMovementId)
    .filter((id): id is string => id !== null);
}

/**
 * Scale a recipe's ingredients to `units` finished units and fold them into the
 * shared requirement map.
 *
 * Ingredient quantity is expressed in the RECIPE's unit, but stock is tracked
 * and recorded in the MATERIAL's unit — convert, or a "500 g" ingredient
 * silently deducts 500 units of "kg" stock.
 */
function explodeRecipeInto(
  need: MaterialNeed,
  recipe: PrimaryRecipe,
  units: number,
  orderId: string
): void {
  const yieldQty = Number(recipe.yieldQuantity);
  if (yieldQty <= 0) {
    console.warn(
      `[stock-deduction] orderId=${orderId} recipeId=${recipe.id}: yieldQuantity=${yieldQty} is zero or negative, skipping ingredient deduction`
    );
    return;
  }

  const scaleFactor = units / yieldQty;
  for (const ing of recipe.ingredients) {
    const raw = convertUnit(Number(ing.quantity) * scaleFactor, ing.unit, ing.material.unit);
    need.set(ing.materialId, (need.get(ing.materialId) ?? 0) + raw);
  }
}

type SelectedOption = { materialId?: string; materialQty?: number };

/**
 * Resolve the material impact of selected modifiers/options.
 *
 * Unchanged in spirit from the original implementation: options carry their own
 * stock impact independently of whether the line's product has a recipe at all,
 * and `materialQty` is already stored in the linked Material's own unit, so no
 * conversion is needed. Two additions: the per-unit cost is captured per LINE
 * for OrderItem.optionCostSnapshot, and the requirement folds into the same
 * `need` map as recipe explosion so everything sums into one deduction per
 * material.
 */
async function resolveOptionMaterials(
  activeItems: { id: string; quantity: Prisma.Decimal; selectedOptions: Prisma.JsonValue | null }[],
  orderId: string
): Promise<{
  optionNeed: MaterialNeed;
  itemOptionCost: Map<string, number>;
  optionMaterials: Map<string, Material>;
}> {
  const optionNeed: MaterialNeed = new Map();
  const itemOptionCost = new Map<string, number>();
  const perItem: { itemId: string; materialId: string; qtyPerUnit: number }[] = [];

  for (const item of activeItems) {
    const orderedQty = Number(item.quantity);
    const selected = (item.selectedOptions as SelectedOption[] | null) ?? [];
    for (const opt of selected) {
      if (!opt.materialId || !opt.materialQty) continue;
      optionNeed.set(
        opt.materialId,
        (optionNeed.get(opt.materialId) ?? 0) + opt.materialQty * orderedQty
      );
      perItem.push({ itemId: item.id, materialId: opt.materialId, qtyPerUnit: opt.materialQty });
    }
  }

  const optionMaterials = new Map<string, Material>();
  if (optionNeed.size > 0) {
    const materials = await prisma.material.findMany({
      where: { id: { in: Array.from(optionNeed.keys()) } },
    });
    for (const material of materials) optionMaterials.set(material.id, material);
  }

  for (const { itemId, materialId, qtyPerUnit } of perItem) {
    const material = optionMaterials.get(materialId);
    if (!material) {
      console.warn(
        `[stock-deduction] orderId=${orderId}: option material=${materialId} not found, skipping`
      );
      continue;
    }
    itemOptionCost.set(
      itemId,
      (itemOptionCost.get(itemId) ?? 0) + qtyPerUnit * Number(material.unitCost)
    );
  }

  // A material that no longer exists must not stay in the requirement map, or
  // the transaction would try to decrement a row that isn't there.
  for (const materialId of Array.from(optionNeed.keys())) {
    if (!optionMaterials.has(materialId)) optionNeed.delete(materialId);
  }

  return { optionNeed, itemOptionCost, optionMaterials };
}

/**
 * Deduct stock when an order is delivered/paid.
 *
 * THE RULE: demand stops at a counted balance.
 *
 * A BATCH_PRODUCED product's ingredients were already consumed when its batch
 * was produced, so a sale draws its finished-goods count and STOPS there —
 * deducting the recipe again on top is the double-count. Whatever the count
 * does NOT cover was physically cooked to order (or prepped and never logged),
 * so that remainder falls through to the recipe, and the fall-through is
 * recorded against an ORDER_SHORTFALL batch so a later production log nets
 * against it instead of drawing the same flour twice.
 *
 * A MADE_TO_ORDER product has no counted balance at all, so every unit falls
 * through to raw materials. An UNTRACKED product has neither.
 *
 * Idempotent per DELIVER cycle: a no-op while an UNREVERSED SALE movement
 * exists, so DELIVERED → CANCELLED → DELIVERED deducts again (correctly)
 * rather than being a permanent no-op.
 *
 * Serializable with bounded retry; all balance reads happen INSIDE the
 * transaction, because a split computed from a pre-transaction read is a lost
 * update under concurrent delivery.
 */
export async function deductStockForOrder(
  orderId: string,
  storeId: string
): Promise<DeductResult> {
  // Idempotency is CYCLE-scoped by time, not by `reversesMovementId`.
  //
  // Excluding individually-reversed SALE ids looks equivalent but is not:
  // reversal is deliberately asymmetric (finished goods come back, cooked
  // ingredients do not — see reverseStockForOrder), so material SALE rows never
  // receive a RETURN and are never in that exclusion set. They would therefore
  // match forever, and an order that was cancelled once could never deduct
  // again — silently, for every MADE_TO_ORDER line, every BATCH shortfall and
  // every material-backed modifier.
  //
  // A deduction is open iff a SALE exists that is NEWER than the most recent
  // RETURN, which is true regardless of which rows that RETURN chose to restore.
  const lastReturn = await prisma.stockMovement.findFirst({
    where: { orderId, type: MovementType.RETURN },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const openSale = await prisma.stockMovement.findFirst({
    where: {
      orderId,
      type: MovementType.SALE,
      ...(lastReturn ? { createdAt: { gt: lastReturn.createdAt } } : {}),
    },
    select: { id: true },
  });
  if (openSale) {
    return { deducted: 0, skipped: 0, alreadyDeducted: true };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { include: primaryRecipeInclude },
          menuItem: { include: { product: { include: primaryRecipeInclude } } },
        },
      },
      store: { select: { business: { select: { userId: true } } } },
    },
  });

  if (!order || order.storeId !== storeId) return { deducted: 0, skipped: 0 };

  const userId = order.store.business.userId;

  // A line item cancelled via KDS (e.g. "out of stock", kitchen mistake) must not
  // consume stock even though the order as a whole still reaches DELIVERED.
  const activeItems = order.items.filter((item) => item.status !== OrderItemStatus.CANCELLED);

  type ResolvedProduct = NonNullable<(typeof activeItems)[number]["product"]>;

  // Aggregate per product BEFORE the stock split. Duplicate line items (the same
  // product on two lines with different modifiers) must be SUMMED, or each would
  // see the full on-hand figure and both would claim it.
  const productAgg = new Map<string, { product: ResolvedProduct; totalQty: number }>();
  const itemUnitCost = new Map<string, number>();
  let skipped = 0;

  for (const item of activeItems) {
    const product = item.product ?? item.menuItem?.product;
    if (!product) {
      console.warn(
        `[stock-deduction] orderId=${orderId} itemId=${item.id}: no product found, skipping`
      );
      skipped++;
      continue;
    }

    // Written for EVERY resolvable product, before any mode branch — Finance
    // margin reads it for untracked and made-to-order lines too. Never move
    // this below a `continue`.
    itemUnitCost.set(item.id, Number(product.costPrice));

    if (product.stockMode === StockMode.UNTRACKED) continue;

    const existing = productAgg.get(product.id);
    if (existing) {
      existing.totalQty += Number(item.quantity);
    } else {
      productAgg.set(product.id, { product, totalQty: Number(item.quantity) });
    }
  }

  const { optionNeed, itemOptionCost, optionMaterials } = await resolveOptionMaterials(
    activeItems,
    orderId
  );

  if (productAgg.size === 0 && optionNeed.size === 0 && itemUnitCost.size === 0) {
    return { deducted: 0, skipped };
  }

  const productIds = Array.from(productAgg.keys());

  type ProductMove = {
    productId: string;
    name: string;
    unit: string;
    minStock: number;
    qty: number;
    balanceAfter: number;
  };
  type MaterialMove = {
    materialId: string;
    name: string;
    unit: string;
    minStock: number;
    qty: number;
    balanceAfter: number;
  };

  const result = await runSerializable(async (tx) => {
    const productMoves: ProductMove[] = [];
    const materialMoves: MaterialMove[] = [];
    const shortfalls: { productId: string; quantity: number }[] = [];
    const belowPrecision: string[] = [];
    const need: MaterialNeed = new Map(optionNeed);

    const balances = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, currentStock: true },
        })
      : [];
    const onHandById = new Map(balances.map((b) => [b.id, Number(b.currentStock)]));

    for (const [productId, { product, totalQty }] of productAgg) {
      const recipe = product.primaryRecipe;
      let onHand = onHandById.get(productId) ?? 0;

      if (product.stockMode === StockMode.MADE_TO_ORDER) {
        // No counted balance exists — never write a product movement.
        if (recipe) explodeRecipeInto(need, recipe, totalQty, orderId);
        continue;
      }

      // ---- BATCH_PRODUCED ----
      if (!recipe) {
        // Nothing to fall back to. Book the whole quantity against the counted
        // balance and LET IT GO NEGATIVE — the honest record of "we sold
        // something the books said we didn't have", and it keeps the
        // append-only ledger reconcilable with currentStock. Surfaced as
        // "Oversold", never auto-corrected.
        const qty = roundStock(totalQty);
        const updated = await tx.product.update({
          where: { id: productId },
          data: { currentStock: { decrement: toDecimal(qty) } },
          select: { currentStock: true },
        });
        productMoves.push({
          productId,
          name: product.name,
          unit: product.unit,
          minStock: Number(product.minStock),
          qty,
          balanceAfter: Number(updated.currentStock),
        });
        continue;
      }

      // A legacy negative balance would otherwise freeze this product out of the
      // ledger forever: fromStock would be 0 on every future sale, no product
      // movement would ever be written again, and Σ quantity would never
      // reconcile. Self-heal it, ledgered and explained.
      if (onHand < 0) {
        const fix = roundStock(-onHand);
        const healed = await tx.product.update({
          where: { id: productId },
          data: { currentStock: { increment: toDecimal(fix) } },
          select: { currentStock: true },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            type: MovementType.ADJUSTMENT,
            quantity: toDecimal(fix),
            unit: product.unit,
            balanceAfter: healed.currentStock,
            reason: "NEGATIVE_BALANCE_CLEARED",
            notes: "Negative balance cleared — sales now draw ingredients for this product",
          },
        });
        onHand = 0;
      }

      const fromStock = roundStock(Math.min(totalQty, onHand));
      const shortfall = roundStock(totalQty - fromStock);

      if (fromStock > 0) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { currentStock: { decrement: toDecimal(fromStock) } },
          select: { currentStock: true },
        });
        productMoves.push({
          productId,
          name: product.name,
          unit: product.unit,
          minStock: Number(product.minStock),
          qty: fromStock,
          balanceAfter: Number(updated.currentStock),
        });
      }

      if (shortfall > 0) {
        explodeRecipeInto(need, recipe, shortfall, orderId);
        shortfalls.push({ productId, quantity: shortfall });
      }
    }

    // ---- Collapse materials. ONE rounding, written to both the balance delta
    // and the movement quantity, so Σ quantity === currentStock exactly.
    const materialIds = Array.from(need.keys());
    const materials = materialIds.length
      ? await tx.material.findMany({ where: { id: { in: materialIds } } })
      : [];
    const materialById = new Map(materials.map((m) => [m.id, m]));

    for (const [materialId, raw] of need) {
      const material = materialById.get(materialId) ?? optionMaterials.get(materialId);
      if (!material) {
        console.warn(
          `[stock-deduction] orderId=${orderId}: material=${materialId} not found, skipping`
        );
        continue;
      }
      // `roundsAwayToZero` only guards a POSITIVE requirement that vanishes at
      // Decimal(10,3). A requirement that is already 0 — or negative, which a
      // mis-signed recipe quantity can produce — slips past it and writes a
      // 0.000 material row plus a 0.000 SALE movement. That movement then
      // matches the idempotency probe above and permanently blocks the order
      // from ever deducting. Nothing to move means nothing to write.
      if (roundStock(raw) === 0 || roundsAwayToZero(raw)) {
        // e.g. 0.4 g of saffron against kg-tracked stock. Writing a 0.000
        // movement would be a permanent silent no-op dressed as a deduction.
        belowPrecision.push(materialId);
        console.warn(
          `[stock-deduction] orderId=${orderId} materialId=${materialId}: requirement ${raw} rounds to 0.000 at Decimal(10,3) — not written`
        );
        continue;
      }

      const qty = roundStock(raw);
      const updated = await tx.material.update({
        where: { id: materialId },
        data: { currentStock: { decrement: toDecimal(qty) } },
        select: { currentStock: true },
      });
      materialMoves.push({
        materialId,
        name: material.name,
        unit: material.unit,
        minStock: Number(material.minStock),
        qty,
        balanceAfter: Number(updated.currentStock),
      });
    }

    // ---- Ledger rows.
    for (const p of productMoves) {
      await tx.stockMovement.create({
        data: {
          productId: p.productId,
          orderId,
          type: MovementType.SALE,
          quantity: toDecimal(-p.qty),
          unit: p.unit,
          balanceAfter: toDecimal(p.balanceAfter),
          notes: saleNote(order.orderNumber),
        },
      });
    }
    for (const m of materialMoves) {
      await tx.stockMovement.create({
        data: {
          materialId: m.materialId,
          orderId,
          type: MovementType.SALE,
          quantity: toDecimal(-m.qty),
          unit: m.unit,
          balanceAfter: toDecimal(m.balanceAfter),
          notes: saleNote(order.orderNumber),
        },
      });
    }

    // ---- Frozen per-line cost. optionCostSnapshot is stored separately so that
    // moving COGS onto snapshots does not delete modifier cost from the P&L.
    for (const [orderItemId, unitCost] of itemUnitCost) {
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          unitCostSnapshot: toDecimal(unitCost),
          optionCostSnapshot: toDecimal(itemOptionCost.get(orderItemId) ?? 0),
        },
      });
    }

    await tx.order.update({ where: { id: orderId }, data: { stockDeductedAt: new Date() } });

    return { productMoves, materialMoves, shortfalls, belowPrecision };
  });

  publishStockChanged(storeId, {
    productIds: result.productMoves.map((p) => p.productId),
    materialIds: result.materialMoves.map((m) => m.materialId),
  });

  // Alerts fire outside the transaction — non-critical, OK to be eventually
  // consistent. Shared with production/waste via stock-alerts.helpers.
  for (const p of result.productMoves) {
    await fireLowStockAlert({
      userId,
      storeId,
      entityId: p.productId,
      entityType: "product",
      name: p.name,
      newStock: p.balanceAfter,
      minStock: p.minStock,
      unit: p.unit,
    });
  }

  // A BATCH product that sold PAST zero writes no product movement for the
  // shortfall portion, so without this the par-level alert would go permanently
  // silent exactly when the owner most needs it — every day they sell out.
  for (const s of result.shortfalls) {
    const entry = productAgg.get(s.productId);
    if (!entry) continue;
    await fireLowStockAlert({
      userId,
      storeId,
      entityId: entry.product.id,
      entityType: "product",
      name: entry.product.name,
      newStock: 0,
      minStock: Number(entry.product.minStock),
      unit: entry.product.unit,
    });
  }

  for (const m of result.materialMoves) {
    await fireLowStockAlert({
      userId,
      storeId,
      entityId: m.materialId,
      entityType: "material",
      name: m.name,
      newStock: m.balanceAfter,
      minStock: m.minStock,
      unit: m.unit,
    });
  }

  // Record the fall-through against this order's ORDER_SHORTFALL batch (or
  // create one) so a later manual production log nets against it rather than
  // drawing the same materials a second time. Imported lazily to avoid an
  // import cycle with production-batch.service.
  if (result.shortfalls.length > 0) {
    try {
      const { productionBatchService } = await import("@/lib/services/production-batch.service");
      await productionBatchService.recordDrawnShortfalls(orderId, storeId, result.shortfalls);
    } catch (err) {
      // The deduction itself is already committed, so throwing here would only
      // lose the caller its result — both call sites swallow it anyway. Logged
      // loudly instead, because the consequence is real: without the debt
      // record, a later production run for this product draws these same
      // materials a second time.
      console.error(
        `[stock-deduction] orderId=${orderId}: FAILED to record drawn shortfalls ` +
          `${JSON.stringify(result.shortfalls)} — a later production run may double-draw these materials`,
        err
      );
    }
  }

  return {
    deducted: result.productMoves.length + result.materialMoves.length,
    skipped,
    shortfalls: result.shortfalls.length ? result.shortfalls : undefined,
    belowPrecision: result.belowPrecision.length ? result.belowPrecision : undefined,
  };
}

/**
 * Reverse stock deducted for an order cancelled after it already reached
 * DELIVERED (i.e. deductStockForOrder already ran for it).
 *
 * TWO changes from the original implementation, both load-bearing:
 *
 * 1. CYCLE-SCOPED. The old query replayed every SALE row for the order with no
 *    cycle bound. Now that re-deduction after DELIVERED → CANCELLED → DELIVERED
 *    is permitted, a second cancel would replay BOTH SALE sets and restore
 *    double — reachable from ordinary bulk-cancel UI. Each RETURN now carries
 *    `reversesMovementId`, and only unreversed SALEs are replayed.
 *
 * 2. ASYMMETRIC BY DEFAULT. Deduction fires at DELIVERED, which means the food
 *    was made and handed over. Crediting raw flour back fabricates flour that is
 *    physically inside food in a bin — and if that food is then binned through
 *    the Waste flow, the same loss is booked twice. So finished goods are
 *    restored (a batch item genuinely goes back on the shelf) and raw materials
 *    are NOT, unless the operator states the food was never made.
 *
 * Historical rows written before the clamps were removed recorded a `quantity`
 * larger than what was actually removed (the balance floored at 0 while the
 * movement kept the full figure). Restoring `abs(quantity)` for those would
 * credit back more than ever left, so the restore is capped at what the
 * movement's own `balanceAfter` proves was removed.
 */
export async function reverseStockForOrder(
  orderId: string,
  storeId: string,
  opts: { foodWasNeverMade?: boolean } = {}
): Promise<{ reversed: number }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, orderNumber: true },
  });
  if (!order || order.storeId !== storeId) return { reversed: 0 };

  const alreadyReversed = await reversedSaleIds(orderId);
  const saleMovements = await prisma.stockMovement.findMany({
    where: {
      orderId,
      type: MovementType.SALE,
      ...(alreadyReversed.length > 0 ? { NOT: { id: { in: alreadyReversed } } } : {}),
    },
    select: {
      id: true,
      productId: true,
      materialId: true,
      quantity: true,
      unit: true,
      balanceAfter: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const replayable = opts.foodWasNeverMade
    ? saleMovements
    : saleMovements.filter((m) => m.productId !== null);

  if (replayable.length === 0) return { reversed: 0 };

  // How much each movement ACTUALLY removed, which is not always what it
  // recorded. Before the clamps were removed, a deduction that would have gone
  // negative wrote a floored `balanceAfter: 0` while still recording the full
  // `quantity` — so restoring abs(quantity) for one of those historical rows
  // would credit back stock that never left. The immediately preceding movement
  // for the same entity gives the balance it started from; the difference is
  // what genuinely moved. Read outside the transaction: these historical rows
  // are immutable.
  const actuallyRemoved = new Map<string, number>();
  for (const movement of replayable) {
    const recorded = Math.abs(Number(movement.quantity));
    const balanceAfter = Number(movement.balanceAfter);

    // Only a floored row can be inflated; anything else recorded truthfully.
    if (balanceAfter !== 0) {
      actuallyRemoved.set(movement.id, recorded);
      continue;
    }

    const previous = await prisma.stockMovement.findFirst({
      where: {
        createdAt: { lt: movement.createdAt },
        ...(movement.productId
          ? { productId: movement.productId }
          : { materialId: movement.materialId }),
      },
      select: { balanceAfter: true },
      orderBy: { createdAt: "desc" },
    });

    // With no prior movement there is nothing to prove inflation against, so
    // trust the recorded figure rather than silently restoring less.
    const balanceBefore = previous ? Number(previous.balanceAfter) : balanceAfter + recorded;
    actuallyRemoved.set(movement.id, Math.min(recorded, Math.max(0, balanceBefore - balanceAfter)));
  }

  await runSerializable(async (tx) => {
    for (const movement of replayable) {
      const restoreQty = roundStock(actuallyRemoved.get(movement.id) ?? 0);
      if (restoreQty <= 0) continue;

      if (movement.productId) {
        const updated = await tx.product.update({
          where: { id: movement.productId },
          data: { currentStock: { increment: toDecimal(restoreQty) } },
          select: { currentStock: true },
        });
        await tx.stockMovement.create({
          data: {
            productId: movement.productId,
            orderId,
            type: MovementType.RETURN,
            quantity: toDecimal(restoreQty),
            unit: movement.unit,
            balanceAfter: updated.currentStock,
            reversesMovementId: movement.id,
            notes: `Restored — order ${order.orderNumber} cancelled`,
          },
        });
      } else if (movement.materialId) {
        const updated = await tx.material.update({
          where: { id: movement.materialId },
          data: { currentStock: { increment: toDecimal(restoreQty) } },
          select: { currentStock: true },
        });
        await tx.stockMovement.create({
          data: {
            materialId: movement.materialId,
            orderId,
            type: MovementType.RETURN,
            quantity: toDecimal(restoreQty),
            unit: movement.unit,
            balanceAfter: updated.currentStock,
            reversesMovementId: movement.id,
            notes: `Restored — order ${order.orderNumber} cancelled`,
          },
        });
      }
    }
  });

  publishStockChanged(storeId, {
    productIds: replayable.map((m) => m.productId).filter((id): id is string => Boolean(id)),
    materialIds: replayable.map((m) => m.materialId).filter((id): id is string => Boolean(id)),
  });

  return { reversed: replayable.length };
}
