import {
  computeOrderCharges,
  type OrderCharges,
  type ResolvedFinanceSettings,
} from "@/lib/finance/order-charges";
import type { CartItem } from "../types/pos.types";

/**
 * Pure allocation maths for "Split bill".
 *
 * Two independent shapes of split share this file:
 *  - BY ITEMS: lines (and per-line quantity) are dealt onto Bill 1…N; each bill
 *    becomes its own Order. `allocateSplit`.
 *  - EQUAL: one bill, N tenders. `splitEqually`.
 *
 * Money is handled in integer cents so allocation is exact: whatever is dealt
 * out always sums back to what was there, with no penny lost or invented.
 */

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/**
 * Largest-remainder apportionment: split `totalCents` across `weights` in
 * proportion, whole cents only, summing to exactly `totalCents`. Zero-weight
 * entries always get zero. Ties go to the earlier index, so the result is
 * deterministic.
 */
export function apportionCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || totalCents <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (totalCents * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  let leftover = totalCents - floors.reduce((s, c) => s + c, 0);

  const byFraction = raw
    .map((r, i) => ({ i, frac: r - floors[i], weight: weights[i] }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0 && k < byFraction.length; k++, leftover--) {
    floors[byFraction[k].i] += 1;
  }
  return floors;
}

/**
 * Split `total` into `parts` shares that add up to it exactly. Every share but
 * the last is rounded down to the currency's smallest cash unit (`decimals`:
 * 0 for IDR/JPY, 2 for EUR/USD), and the last absorbs the remainder — so the
 * last person may pay a few units more, but no one is asked for a fraction of a
 * coin that doesn't exist.
 */
export function splitEqually(total: number, parts: number, decimals = 2): number[] {
  if (!Number.isInteger(parts) || parts < 1) return [];
  const cents = toCents(total);
  const stepCents = Math.pow(10, 2 - Math.min(Math.max(decimals, 0), 2));
  const base = Math.floor(cents / parts / stepCents) * stepCents;
  const shares = Array.from({ length: parts }, () => base);
  shares[parts - 1] = cents - base * (parts - 1);
  return shares.map(fromCents);
}

// ─── Split by items ──────────────────────────────────────────────────────────

export interface SplitAssignment {
  /** CartItem.id */
  lineId: string;
  /** Quantity of this line dealt onto each bill, indexed by bill. */
  quantities: number[];
}

export interface SplitBill {
  index: number;
  items: CartItem[];
  itemsTotal: number;
  /** This bill's proportional share of the cart's discount. */
  discountShare: number;
  /** Computed exactly as the server will for this bill on its own. */
  charges: OrderCharges;
}

export interface SplitRemainder {
  items: CartItem[];
  itemsTotal: number;
  discountShare: number;
}

export interface SplitResult {
  bills: SplitBill[];
  /** Lines (and quantities) not yet dealt onto any bill — stays in the cart. */
  remainder: SplitRemainder;
  /** Indices of bills that currently hold nothing (cannot be paid yet). */
  emptyBills: number[];
}

export type SplitError = "OVER_ASSIGNED" | "INVALID_QUANTITY";

export type AllocateSplitResult =
  | { ok: true; result: SplitResult }
  | { ok: false; error: SplitError; lineId: string };

function perUnitPrice(item: CartItem): number {
  return item.unitPrice + item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0);
}

function withQuantity(item: CartItem, quantity: number): CartItem {
  return { ...item, quantity, lineTotal: fromCents(toCents(perUnitPrice(item) * quantity)) };
}

/**
 * Deal cart lines onto `billCount` bills. The cart's discount is shared out in
 * proportion to each bill's item total (and the undealt remainder's), exact to
 * the cent, so Σ discountShare over bills + remainder equals the whole
 * discount. Each bill's charges are then computed independently through
 * computeOrderCharges — the very function the server runs when that bill is
 * paid — so what the cashier sees is what gets stored. In tax-inclusive mode
 * the bill totals therefore add up to the cart total exactly; in
 * tax-exclusive mode per-bill rounding of service charge and tax can differ
 * from the whole cart's by a cent or so, which is inherent to taxing each bill
 * separately.
 */
export function allocateSplit(args: {
  items: CartItem[];
  assignments: SplitAssignment[];
  billCount: number;
  discountAmount: number;
  settings: ResolvedFinanceSettings;
}): AllocateSplitResult {
  const { items, assignments, billCount, discountAmount, settings } = args;
  const byLine = new Map(assignments.map((a) => [a.lineId, a.quantities]));

  const billItems: CartItem[][] = Array.from({ length: billCount }, () => []);
  const remainderItems: CartItem[] = [];

  for (const item of items) {
    const quantities = byLine.get(item.id) ?? [];
    let assigned = 0;
    for (let b = 0; b < billCount; b++) {
      const q = quantities[b] ?? 0;
      if (!Number.isInteger(q) || q < 0) {
        return { ok: false, error: "INVALID_QUANTITY", lineId: item.id };
      }
      if (q > 0) billItems[b].push(withQuantity(item, q));
      assigned += q;
    }
    if (assigned > item.quantity) {
      return { ok: false, error: "OVER_ASSIGNED", lineId: item.id };
    }
    if (assigned < item.quantity) remainderItems.push(withQuantity(item, item.quantity - assigned));
  }

  const totalOf = (list: CartItem[]) =>
    fromCents(list.reduce((s, i) => s + toCents(i.lineTotal), 0));
  const billTotals = billItems.map(totalOf);
  const remainderTotal = totalOf(remainderItems);
  const wholeTotal = fromCents([...billTotals, remainderTotal].reduce((s, t) => s + toCents(t), 0));

  const discountCents = toCents(Math.min(Math.max(discountAmount, 0), wholeTotal));
  const shares = apportionCents(discountCents, [...billTotals, remainderTotal].map(toCents));

  const chargeSettings: ResolvedFinanceSettings = { ...settings, processingFeeEnabled: false };
  const bills: SplitBill[] = billItems.map((list, index) => {
    const discountShare = fromCents(shares[index]);
    return {
      index,
      items: list,
      itemsTotal: billTotals[index],
      discountShare,
      charges: computeOrderCharges({
        itemsTotal: billTotals[index],
        discountAmount: discountShare,
        paymentMethod: "CASH",
        settings: chargeSettings,
      }),
    };
  });

  return {
    ok: true,
    result: {
      bills,
      remainder: {
        items: remainderItems,
        itemsTotal: remainderTotal,
        discountShare: fromCents(shares[billCount]),
      },
      emptyBills: bills.filter((b) => b.items.length === 0).map((b) => b.index),
    },
  };
}
