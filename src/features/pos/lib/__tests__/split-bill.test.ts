import { describe, it, expect } from "vitest";
import { allocateSplit, apportionCents, splitEqually } from "../split-bill";
import type { CartItem } from "../../types/pos.types";
import type { ResolvedFinanceSettings } from "@/lib/finance/order-charges";

const noCharges: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

const line = (id: string, unitPrice: number, quantity: number, modifierTotal = 0): CartItem => ({
  id,
  menuItemId: `menu-${id}`,
  name: id.toUpperCase(),
  unitPrice,
  quantity,
  modifiers: modifierTotal
    ? [{ groupName: "Extra", optionName: "Extra", priceAdjustment: modifierTotal }]
    : [],
  lineTotal: (unitPrice + modifierTotal) * quantity,
});

const cents = (n: number) => Math.round(n * 100);

describe("apportionCents", () => {
  it("shares proportionally, exactly", () => {
    expect(apportionCents(1_000, [3, 2, 5])).toEqual([300, 200, 500]);
  });

  it("hands leftover cents to the earliest largest fractions and still sums exactly", () => {
    expect(apportionCents(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("gives zero-weight entries zero", () => {
    expect(apportionCents(100, [1, 0, 1])).toEqual([50, 0, 50]);
  });

  it("returns zeros for no weight or no amount, and [] for no entries", () => {
    expect(apportionCents(100, [0, 0])).toEqual([0, 0]);
    expect(apportionCents(0, [1, 2])).toEqual([0, 0]);
    expect(apportionCents(100, [])).toEqual([]);
  });

  it.each([
    [1, [1, 1, 1]],
    [7, [5, 3, 2, 1]],
    [99_999, [13, 17, 19, 23, 29]],
    [100_000, [1, 1, 1, 1, 1, 1, 1]],
  ])("always sums to the total (%s over %j)", (total, weights) => {
    const out = apportionCents(total, weights);
    expect(out.reduce((s, c) => s + c, 0)).toBe(total);
    expect(out.every((c) => c >= 0)).toBe(true);
  });
});

describe("splitEqually", () => {
  it("splits to the cent and the last share absorbs the remainder", () => {
    expect(splitEqually(100, 3, 2)).toEqual([33.33, 33.33, 33.34]);
  });

  it("gives whole units in a zero-decimal currency (IDR)", () => {
    expect(splitEqually(182_400, 3, 0)).toEqual([60_800, 60_800, 60_800]);
    expect(splitEqually(100_000, 3, 0)).toEqual([33_333, 33_333, 33_334]);
  });

  it("still sums exactly when an IDR total carries a fraction", () => {
    const shares = splitEqually(182_400.5, 3, 0);
    expect(shares).toEqual([60_800, 60_800, 60_800.5]);
    expect(shares.reduce((s, n) => s + cents(n), 0)).toBe(cents(182_400.5));
  });

  it("one part is the whole total; bad part counts give nothing", () => {
    expect(splitEqually(42.5, 1)).toEqual([42.5]);
    expect(splitEqually(42.5, 0)).toEqual([]);
    expect(splitEqually(42.5, 2.5)).toEqual([]);
  });

  it.each([2, 3, 4, 5, 6, 7, 9, 10])("%i shares always add up to the total", (parts) => {
    for (const decimals of [0, 2]) {
      const shares = splitEqually(182_403.37, parts, decimals);
      expect(shares).toHaveLength(parts);
      expect(shares.reduce((s, n) => s + cents(n), 0)).toBe(cents(182_403.37));
    }
  });
});

describe("allocateSplit", () => {
  const items = [line("a", 10_000, 3), line("b", 20_000, 1)];

  it("deals lines onto bills and shares the discount proportionally", () => {
    const out = allocateSplit({
      items,
      assignments: [
        { lineId: "a", quantities: [2, 1] },
        { lineId: "b", quantities: [0, 1] },
      ],
      billCount: 2,
      discountAmount: 3_000,
      settings: noCharges,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const { bills, remainder, emptyBills } = out.result;
    // Bill 1: 2×A = 20k. Bill 2: 1×A + 1×B = 30k. The 3k discount splits 20:30.
    expect(bills.map((b) => b.itemsTotal)).toEqual([20_000, 30_000]);
    expect(bills.map((b) => b.discountShare)).toEqual([1_200, 1_800]);
    expect(bills.map((b) => b.charges.total)).toEqual([18_800, 28_200]);
    expect(remainder.items).toEqual([]);
    expect(emptyBills).toEqual([]);
  });

  it("keeps undealt quantities in the remainder and flags empty bills", () => {
    const out = allocateSplit({
      items,
      assignments: [{ lineId: "a", quantities: [1, 0] }],
      billCount: 2,
      discountAmount: 5_000,
      settings: noCharges,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const { bills, remainder, emptyBills } = out.result;
    expect(emptyBills).toEqual([1]);
    expect(bills[0].items.map((i) => [i.id, i.quantity, i.lineTotal])).toEqual([["a", 1, 10_000]]);
    expect(remainder.items.map((i) => [i.id, i.quantity])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
    // 50k whole: bill0 10k, bill1 0, remainder 40k → 1k / 0 / 4k of the 5k.
    expect([bills[0].discountShare, bills[1].discountShare, remainder.discountShare]).toEqual([
      1_000, 0, 4_000,
    ]);
  });

  it("the whole discount is always accounted for, to the cent", () => {
    const three = [line("x", 10_000, 3)];
    const out = allocateSplit({
      items: three,
      assignments: [{ lineId: "x", quantities: [1, 1, 1] }],
      billCount: 3,
      discountAmount: 100,
      settings: noCharges,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const shares = out.result.bills.map((b) => b.discountShare);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((s, n) => s + cents(n), 0)).toBe(10_000);
  });

  it("prices a line with modifiers per unit", () => {
    const out = allocateSplit({
      items: [line("m", 10_000, 3, 2_000)],
      assignments: [{ lineId: "m", quantities: [2] }],
      billCount: 1,
      discountAmount: 0,
      settings: noCharges,
    });
    expect(out.ok && out.result.bills[0].items[0].lineTotal).toBe(24_000);
    expect(out.ok && out.result.remainder.itemsTotal).toBe(12_000);
  });

  it("clamps a discount larger than the cart", () => {
    const out = allocateSplit({
      items: [line("a", 1_000, 1)],
      assignments: [{ lineId: "a", quantities: [1] }],
      billCount: 1,
      discountAmount: 9_999,
      settings: noCharges,
    });
    expect(out.ok && out.result.bills[0].discountShare).toBe(1_000);
    expect(out.ok && out.result.bills[0].charges.total).toBe(0);
  });

  it("rejects over-assignment and invalid quantities, naming the line", () => {
    const base = { items, billCount: 2, discountAmount: 0, settings: noCharges };
    expect(allocateSplit({ ...base, assignments: [{ lineId: "a", quantities: [2, 2] }] })).toEqual({
      ok: false,
      error: "OVER_ASSIGNED",
      lineId: "a",
    });
    expect(
      allocateSplit({ ...base, assignments: [{ lineId: "a", quantities: [1.5, 0] }] })
    ).toEqual({ ok: false, error: "INVALID_QUANTITY", lineId: "a" });
    expect(allocateSplit({ ...base, assignments: [{ lineId: "a", quantities: [-1, 0] }] })).toEqual(
      { ok: false, error: "INVALID_QUANTITY", lineId: "a" }
    );
  });

  it("tax-inclusive: bill totals add up to the discounted cart total exactly", () => {
    const three = [line("p", 33_333, 1), line("q", 33_333, 1), line("r", 33_333, 1)];
    const out = allocateSplit({
      items: three,
      assignments: [
        { lineId: "p", quantities: [1, 0, 0] },
        { lineId: "q", quantities: [0, 1, 0] },
        { lineId: "r", quantities: [0, 0, 1] },
      ],
      billCount: 3,
      discountAmount: 1_000,
      settings: { ...noCharges, taxEnabled: true, taxRate: 0.11, taxInclusive: true },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const sum = out.result.bills.reduce((s, b) => s + cents(b.charges.total), 0);
    expect(sum).toBe(cents(99_999 - 1_000));
  });

  it("charges each bill exactly as the server will (tax-exclusive service + tax)", () => {
    const out = allocateSplit({
      items: [line("a", 10_000, 2)],
      assignments: [{ lineId: "a", quantities: [1, 1] }],
      billCount: 2,
      discountAmount: 0,
      settings: {
        ...noCharges,
        taxEnabled: true,
        taxRate: 0.1,
        taxInclusive: false,
        serviceChargeEnabled: true,
        serviceChargeRate: 0.05,
      },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // 10,000 + 5% service (500) + 10% of 10,500 (1,050) = 11,550 per bill.
    expect(out.result.bills.map((b) => b.charges.total)).toEqual([11_550, 11_550]);
  });
});
