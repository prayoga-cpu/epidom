import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The shared settlement helper is where a single-tender order stays
 * byte-identical to the pre-multi-tender code and where a split order gets its
 * blended fee. Everything here runs without a database: prisma is mocked, and
 * the money math (computeOrderCharges / order-payments) is the real thing, so
 * these assertions are about actual persisted numbers.
 */

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    customer: { findFirst: vi.fn() },
    order: { update: vi.fn() },
    table: { findFirst: vi.fn() },
  };
  return { prisma: prismaMock };
});

vi.mock("../finance-settings.service", () => ({
  resolveFinanceSettingsForOrder: vi.fn(),
}));

vi.mock("../pos-order-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pos-order-builder")>();
  return { ...actual, validateAndBuildOrderItems: vi.fn() };
});

vi.mock("../pos-discount.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pos-discount.service")>();
  return { ...actual, resolveOrderDiscount: vi.fn() };
});

vi.mock("../loyalty.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../loyalty.service")>();
  return {
    ...actual,
    consumeCouponUse: vi.fn(),
    redeemPointsForOrder: vi.fn(),
    earnPointsForOrder: vi.fn(),
    reverseLoyaltyForOrder: vi.fn(),
  };
});

import {
  applySettlementBookkeeping,
  buildPosOrderCreatedResponse,
  buildPosSettlement,
  buildSettlementOrderData,
  cancelOrderInTx,
  claimHeldOrderForSettlement,
  mergeHeldOrdersInTx,
  settlePendingOrderInTx,
  SettlementError,
  posOrderSource,
  resolveStoreTableId,
} from "../pos-order-settlement";
import { validateAndBuildOrderItems } from "../pos-order-builder";
import { resolveOrderDiscount, type ResolvedOrderDiscount } from "../pos-discount.service";
import { resolveFinanceSettingsForOrder } from "../finance-settings.service";
import {
  consumeCouponUse,
  earnPointsForOrder,
  redeemPointsForOrder,
  reverseLoyaltyForOrder,
  LoyaltyConflictError,
} from "../loyalty.service";

const STORE = { kitchenDisplayEnabled: true, payLaterEnabled: true };

const NO_CHARGES = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: false,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

function menuLine(total: number) {
  return {
    menuItemId: "menu-1",
    name: "Latte",
    quantity: 1,
    unit: "pcs",
    unitPrice: total,
    total,
    isCustom: false,
    department: null,
    initialStatus: "PENDING" as const,
  };
}

function noDiscount(): ResolvedOrderDiscount {
  return {
    discountAmount: 0,
    discountReason: undefined,
    couponId: null,
    couponMaxUses: null,
    pointsRedeemed: 0,
    warnings: [],
  };
}

/** The legacy (pre-multi-tender) request body shape. */
function legacyInput(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ menuItemId: "menu-1", name: "Latte", quantity: 1, unitPrice: 100 }],
    paymentMethod: "CASH",
    orderType: "TAKEAWAY",
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAndBuildOrderItems).mockResolvedValue({
    orderItems: [menuLine(100)],
    subtotal: 100,
  });
  vi.mocked(resolveFinanceSettingsForOrder).mockResolvedValue({ ...NO_CHARGES });
  vi.mocked(resolveOrderDiscount).mockResolvedValue(noDiscount());
  vi.mocked(earnPointsForOrder).mockResolvedValue(0);
});

describe("buildPosSettlement — legacy single-method payloads", () => {
  it("converts a legacy CASH payload into exactly one tender", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ amountTendered: 150 }),
    });

    expect(s.tenders).toEqual([
      { method: "CASH", amount: 100, amountTendered: 150, change: 50, note: null },
    ]);
    // A single tender must NOT be labelled SPLIT.
    expect(s.paymentMethod).toBe("CASH");
    expect(s.paymentStatus).toBe("PAID");
    expect(s.change).toBe(50);
  });

  it("keeps the exact legacy message when cash is short", async () => {
    await expect(
      buildPosSettlement({
        storeId: "store-1",
        store: STORE,
        input: legacyInput({ amountTendered: 40 }),
      })
    ).rejects.toMatchObject({
      message: "Amount tendered is less than the order total",
      status: 422,
    });
  });

  it("carries the OTHER label onto the tender row", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ paymentMethod: "OTHER", paymentNote: "Company account" }),
    });
    expect(s.tenders[0]).toMatchObject({ method: "OTHER", note: "Company account" });
  });

  it("leaves change null when no cash was tendered", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ paymentMethod: "QRIS" }),
    });
    expect(s.change).toBeNull();
  });
});

describe("buildPosSettlement — multi-tender", () => {
  it("marks the order SPLIT and records every tender", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({
        paymentMethod: undefined,
        payments: [
          { method: "CASH", amount: 60, amountTendered: 100 },
          { method: "QRIS", amount: 40 },
        ],
      }),
    });

    expect(s.paymentMethod).toBe("SPLIT");
    expect(s.tenders).toHaveLength(2);
    expect(s.change).toBe(40);
  });

  it("rejects tenders that do not add up to the repriced total", async () => {
    await expect(
      buildPosSettlement({
        storeId: "store-1",
        store: STORE,
        input: legacyInput({
          payments: [{ method: "CASH", amount: 60 }],
        }),
      })
    ).rejects.toBeInstanceOf(SettlementError);
  });

  it("ignores the legacy paymentMethod entirely when payments[] is present", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({
        paymentMethod: "PAY_LATER",
        payments: [{ method: "CASH", amount: 100 }],
      }),
    });
    expect(s.paymentStatus).toBe("PAID");
    expect(s.paymentMethod).toBe("CASH");
  });
});

describe("buildPosSettlement — processing fee", () => {
  const WITH_FEES = {
    ...NO_CHARGES,
    processingFeeEnabled: true,
    // Explicit overrides so the test doesn't depend on the default table.
    processingFeeOverrides: {
      CASH: { percent: 0, flat: 0 },
      QRIS: { percent: 0.01, flat: 0 },
    } as any,
  };

  it("matches the single-method calculation exactly for one tender", async () => {
    vi.mocked(resolveFinanceSettingsForOrder).mockResolvedValue(WITH_FEES);

    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ paymentMethod: "QRIS" }),
    });

    expect(s.charges.processingFee).toBe(1);
    // The persisted rate is still the METHOD's own percent, not a blend.
    expect(s.charges.processingFeeRate).toBe(0.01);
  });

  it("sums the fee per tender and stores the blended rate for a split", async () => {
    vi.mocked(resolveFinanceSettingsForOrder).mockResolvedValue(WITH_FEES);

    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({
        payments: [
          { method: "CASH", amount: 50 },
          { method: "QRIS", amount: 50 },
        ],
      }),
    });

    // Only the QRIS half is charged a fee…
    expect(s.charges.processingFee).toBe(0.5);
    // …so the blended rate is half of the QRIS rate.
    expect(s.charges.processingFeeRate).toBe(0.005);
    // The customer's total never moves because of a merchant fee.
    expect(s.charges.total).toBe(100);
  });
});

describe("buildPosSettlement — Pay Later and zero bills", () => {
  it("keeps the Pay Later path: PENDING, no tenders", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ paymentMethod: "PAY_LATER" }),
    });

    expect(s.paymentStatus).toBe("PENDING");
    expect(s.paymentMethod).toBe("PAY_LATER");
    expect(s.tenders).toEqual([]);
  });

  it("rejects Pay Later when the store has it off", async () => {
    await expect(
      buildPosSettlement({
        storeId: "store-1",
        store: { ...STORE, payLaterEnabled: false },
        input: legacyInput({ paymentMethod: "PAY_LATER" }),
      })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("accepts a fully discounted bill with no tender at all", async () => {
    vi.mocked(resolveOrderDiscount).mockResolvedValue({
      ...noDiscount(),
      discountAmount: 100,
      discountReason: "Preset: On the house",
    });

    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput(),
    });

    expect(s.charges.total).toBe(0);
    expect(s.tenders).toEqual([]);
    expect(s.paymentMethod).toBe("CASH");
  });
});

describe("buildPosSettlement — customer snapshot", () => {
  it("snapshots name/phone/email off the Customer record", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "cus-1",
      name: "Amélie",
      phone: "+33612345678",
      email: "amelie@example.com",
    });

    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ customerId: "cus-1", customerName: "Walk-in" }),
    });

    expect(s.customerName).toBe("Amélie");
    const data = buildSettlementOrderData({ settlement: s, input: legacyInput({}) });
    expect(data.customerName).toBe("Amélie");
    expect(data.customerPhone).toBe("+33612345678");
    expect(data.customerEmail).toBe("amelie@example.com");
    expect(data.customerId).toBe("cus-1");
  });

  it("rejects a customer from another store", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    await expect(
      buildPosSettlement({
        storeId: "store-1",
        store: STORE,
        input: legacyInput({ customerId: "cus-other" }),
      })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("records the sale anyway on an offline replay", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ customerId: "cus-other", clientRequestId: "queue-1" }),
    });

    expect(s.customer).toBeNull();
    expect(s.warnings).toHaveLength(1);
    expect(s.tolerant).toBe(true);
  });
});

describe("buildSettlementOrderData", () => {
  it("writes the tender rows and the loyalty columns", async () => {
    vi.mocked(resolveOrderDiscount).mockResolvedValue({
      ...noDiscount(),
      discountAmount: 20,
      discountReason: "Coupon: SAVE20",
      couponId: "cp-1",
      couponMaxUses: 5,
      pointsRedeemed: 0,
    });
    vi.mocked(validateAndBuildOrderItems).mockResolvedValue({
      orderItems: [
        menuLine(100),
        {
          menuItemId: null,
          name: "Corkage",
          quantity: 1,
          unit: "pcs",
          unitPrice: 20,
          total: 20,
          isCustom: true,
          department: "BAR",
          initialStatus: "PENDING",
        } as any,
      ],
      subtotal: 120,
    });

    const input = legacyInput({ couponCode: "SAVE20", splitGroupId: "split-1" });
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });
    const data = buildSettlementOrderData({ settlement: s, input });

    expect(Number(data.total)).toBe(100);
    expect(Number(data.discountAmount)).toBe(20);
    expect(data.discountReason).toBe("Coupon: SAVE20");
    expect(data.couponId).toBe("cp-1");
    expect(data.splitGroupId).toBe("split-1");
    expect(data.payments.create).toEqual([expect.objectContaining({ method: "CASH" })]);
    // The Custom Item's flags ride along on the nested item create.
    expect(data.items.create[1]).toMatchObject({
      menuItemId: null,
      isCustom: true,
      department: "BAR",
    });
    expect(data.items.create[0]).toMatchObject({ isCustom: false, department: null });
  });

  it("clears discountReason when there is no discount", async () => {
    // Explicitly null, never undefined — see the "discountReason clearing"
    // block below for why that distinction is the whole bug.
    const input = legacyInput();
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });
    expect(buildSettlementOrderData({ settlement: s, input }).discountReason).toBeNull();
  });

  it("falls back to the held order's pax count and name on finalize", async () => {
    const input = legacyInput({ orderType: "DINE_IN" });
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });

    const data = buildSettlementOrderData({
      settlement: s,
      input,
      fallbackCustomerName: "Table 4",
      existingGuestCount: 6,
    });
    expect(data.guestCount).toBe(6);
    expect(data.customerName).toBe("Table 4");
  });

  it("appends replay warnings to the order notes", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    const input = legacyInput({
      customerId: "cus-other",
      clientRequestId: "queue-1",
      notes: "extra hot",
    });
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });
    const data = buildSettlementOrderData({ settlement: s, input });

    expect(data.notes).toContain("extra hot");
    expect(data.notes).toContain("Customer not found");
  });
});

describe("applySettlementBookkeeping", () => {
  const tx = {
    order: { update: vi.fn() },
  } as any;

  beforeEach(() => {
    tx.order.update.mockReset();
  });

  async function settlementWith(discount: Partial<ResolvedOrderDiscount>, input = legacyInput()) {
    vi.mocked(resolveOrderDiscount).mockResolvedValue({ ...noDiscount(), ...discount });
    return buildPosSettlement({ storeId: "store-1", store: STORE, input });
  }

  it("consumes the coupon, burns the points and earns on a PAID order", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "cus-1",
      name: "A",
      phone: null,
      email: null,
    });
    vi.mocked(earnPointsForOrder).mockResolvedValue(7);

    const s = await settlementWith(
      { couponId: "cp-1", couponMaxUses: 5, pointsRedeemed: 30, discountAmount: 30 },
      legacyInput({ customerId: "cus-1" })
    );

    const result = await applySettlementBookkeeping(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      settlement: s,
    });

    expect(consumeCouponUse).toHaveBeenCalledWith(
      { couponId: "cp-1", storeId: "store-1", maxUses: 5 },
      tx
    );
    expect(redeemPointsForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus-1", orderId: "ord-1", points: 30 }),
      tx
    );
    expect(result.pointsEarned).toBe(7);
  });

  it("never earns points for a Pay Later order at placement", async () => {
    const s = await settlementWith({}, legacyInput({ paymentMethod: "PAY_LATER" }));
    const result = await applySettlementBookkeeping(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      settlement: s,
    });

    expect(earnPointsForOrder).not.toHaveBeenCalled();
    expect(result.pointsEarned).toBe(0);
  });

  it("rethrows a lost coupon race on a normal (online) order", async () => {
    vi.mocked(consumeCouponUse).mockRejectedValueOnce(new LoyaltyConflictError("used up"));
    const s = await settlementWith({ couponId: "cp-1", couponMaxUses: 1 });

    await expect(
      applySettlementBookkeeping(tx, { orderId: "ord-1", storeId: "store-1", settlement: s })
    ).rejects.toBeInstanceOf(LoyaltyConflictError);
  });

  it("degrades a lost coupon race on an offline replay instead of losing the sale", async () => {
    vi.mocked(consumeCouponUse).mockRejectedValueOnce(new LoyaltyConflictError("used up"));
    const s = await settlementWith(
      { couponId: "cp-1", couponMaxUses: 1, discountAmount: 10 },
      legacyInput({ clientRequestId: "queue-1" })
    );

    const result = await applySettlementBookkeeping(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      settlement: s,
      currentNotes: "extra hot",
    });

    // The money stands; only the claim to the coupon is dropped.
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "ord-1" },
      data: expect.objectContaining({ couponId: null }),
    });
    expect(result.warnings).toHaveLength(1);
  });
});

describe("buildPosOrderCreatedResponse", () => {
  it("returns the new DTO fields alongside the ones old clients read", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ amountTendered: 150 }),
    });

    const dto = buildPosOrderCreatedResponse(
      { id: "ord-1", orderNumber: "POS-1", status: "CONFIRMED", paymentStatus: "PAID" },
      s,
      12
    );

    expect(dto).toMatchObject({
      orderId: "ord-1",
      orderNumber: "POS-1",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      total: 100,
      discountAmount: 0,
      paymentMethod: "CASH",
      change: 50,
      pointsEarned: 12,
    });
    expect(dto.payments).toHaveLength(1);
  });
});

// ─── Guarded transaction bodies ──────────────────────────────────────────────

function makeTx() {
  return {
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: "tgt", orderNumber: "POS-TGT", total: 100 }),
      findUnique: vi.fn().mockResolvedValue({ total: 100 }),
    },
    orderItem: {
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ total: 100 }]),
    },
    orderPayment: { create: vi.fn() },
    table: { updateMany: vi.fn() },
  } as any;
}

describe("claimHeldOrderForSettlement", () => {
  it("passes silently for the caller that took the bill", async () => {
    const tx = makeTx();
    await expect(
      claimHeldOrderForSettlement(tx, {
        orderId: "ord-1",
        storeId: "store-1",
        settledStatus: "CONFIRMED",
      })
    ).resolves.toBeUndefined();
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { status: "HELD", id: "ord-1", storeId: "store-1" },
      data: { status: "CONFIRMED" },
    });
  });

  it("throws a 409 the moment the bill is no longer held", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      claimHeldOrderForSettlement(tx, {
        orderId: "ord-1",
        storeId: "store-1",
        settledStatus: "CONFIRMED",
      })
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

describe("settlePendingOrderInTx", () => {
  it("writes one tender row and earns points for the winner", async () => {
    const tx = makeTx();
    vi.mocked(earnPointsForOrder).mockResolvedValue(5);

    const result = await settlePendingOrderInTx(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      tenderMethod: "CASH",
      paymentNote: "  paid at the counter  ",
      hasExistingPayments: false,
    });

    expect(result).toEqual({ settled: true, pointsEarned: 5 });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { paymentStatus: { not: "PAID" }, id: "ord-1", storeId: "store-1" },
      data: { paymentStatus: "PAID" },
    });
    expect(tx.orderPayment.create).toHaveBeenCalledTimes(1);
    expect(tx.orderPayment.create.mock.calls[0][0].data.note).toBe("paid at the counter");
  });

  it("does NOTHING when a concurrent settle already won the transition", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await settlePendingOrderInTx(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      tenderMethod: "CASH",
      hasExistingPayments: false,
    });

    expect(result).toEqual({ settled: false, pointsEarned: 0 });
    // The two writes that would have doubled the money.
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
    expect(earnPointsForOrder).not.toHaveBeenCalled();
  });

  it("skips the tender row when the order already carries one", async () => {
    const tx = makeTx();
    await settlePendingOrderInTx(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      tenderMethod: "CASH",
      hasExistingPayments: true,
    });
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });

  it("skips the tender row when no real method can be named, but still earns", async () => {
    const tx = makeTx();
    vi.mocked(earnPointsForOrder).mockResolvedValue(3);

    const result = await settlePendingOrderInTx(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      tenderMethod: null,
      hasExistingPayments: false,
    });

    expect(tx.orderPayment.create).not.toHaveBeenCalled();
    expect(result.pointsEarned).toBe(3);
  });
});

describe("cancelOrderInTx", () => {
  it("reverses loyalty exactly once, for the winner only", async () => {
    const tx = makeTx();

    await expect(cancelOrderInTx(tx, { orderId: "ord-1", storeId: "store-1" })).resolves.toBe(true);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { status: { not: "CANCELLED" }, id: "ord-1", storeId: "store-1" },
      data: { status: "CANCELLED" },
    });
    expect(reverseLoyaltyForOrder).toHaveBeenCalledWith("ord-1", 1, tx);
  });

  it("does not release the coupon twice when it loses the cancel race", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(cancelOrderInTx(tx, { orderId: "ord-1", storeId: "store-1" })).resolves.toBe(
      false
    );
    expect(reverseLoyaltyForOrder).not.toHaveBeenCalled();
  });
});

describe("mergeHeldOrdersInTx", () => {
  const target = { id: "tgt", orderNumber: "POS-TGT", discountAmount: 0, tableId: "table-1" };
  const sources = [
    { id: "src-1", notes: "no onions", tableId: "table-2" },
    { id: "src-2", notes: null, tableId: "table-1" },
  ];
  const args = { storeId: "store-1", target, sources, financeSettings: { ...NO_CHARGES } };

  it("claims target and sources, then re-parents and relabels", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });

    const result = await mergeHeldOrdersInTx(tx, args);

    expect(result).toEqual({ id: "tgt", orderNumber: "POS-TGT", total: 100 });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ["src-1", "src-2"] } },
      data: { orderId: "tgt" },
    });
    // Ledger, not delete: the sources keep their row with a trail.
    const noteWrites = tx.order.update.mock.calls.filter((c: any[]) => c[0].data?.notes);
    expect(noteWrites).toHaveLength(2);
    expect(noteWrites[0][0].data.notes).toBe("no onions · Merged into #POS-TGT");
    // Only the source table that isn't the target's own is freed.
    expect(tx.table.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["table-2"] }, storeId: "store-1" },
      data: { status: "AVAILABLE" },
    });
  });

  it("aborts before moving a single line when the target was finalized meanwhile", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(mergeHeldOrdersInTx(tx, args)).rejects.toMatchObject({ status: 409 });
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("aborts when only SOME sources are still saved", async () => {
    const tx = makeTx();
    tx.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 }); // one of two

    await expect(mergeHeldOrdersInTx(tx, args)).rejects.toMatchObject({ status: 409 });
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });
});

// ─── Regressions from the concurrency review ─────────────────────────────────

describe("zero-total bills", () => {
  beforeEach(() => {
    vi.mocked(resolveOrderDiscount).mockResolvedValue({
      ...noDiscount(),
      discountAmount: 100,
      discountReason: "Preset: On the house",
    });
  });

  it("still accepts the legacy 'on the house' sale with no tender", async () => {
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput(),
    });
    expect(s.charges.total).toBe(0);
    expect(s.tenders).toEqual([]);
  });

  it("REJECTS explicit tenders against a server-priced total of zero", async () => {
    // The client thinks money changed hands and the server thinks the bill is
    // free — dropping those rows silently would make a cash receipt vanish
    // from the drawer. Surface the disagreement instead.
    await expect(
      buildPosSettlement({
        storeId: "store-1",
        store: STORE,
        input: legacyInput({ payments: [{ method: "CASH", amount: 100 }] }),
      })
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("do not equal") });
  });

  it("uses one method precedence for the stored method and the fee basis", async () => {
    // payments[] wins over the legacy field in BOTH places.
    const s = await buildPosSettlement({
      storeId: "store-1",
      store: STORE,
      input: legacyInput({ paymentMethod: "QRIS" }),
    });
    expect(s.paymentMethod).toBe("QRIS");
  });
});

describe("discountReason clearing", () => {
  it("writes null (not undefined) so a removed discount clears the stale reason", async () => {
    const input = legacyInput();
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });
    const data = buildSettlementOrderData({ settlement: s, input });

    // `undefined` is a no-op on a Prisma UPDATE, which left "Coupon: SAVE20"
    // sitting next to a zero discount on a finalized bill.
    expect(data.discountReason).toBeNull();
  });
});

describe("customerId is three-state", () => {
  it("keeps the held order's customer when the body omits customerId", async () => {
    const input = legacyInput();
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });

    const data = buildSettlementOrderData({
      settlement: s,
      input,
      existingCustomerId: "cus-from-hold",
    });
    expect(data.customerId).toBe("cus-from-hold");
  });

  it("detaches on an explicit null", async () => {
    const input = legacyInput({ customerId: null });
    const s = await buildPosSettlement({ storeId: "store-1", store: STORE, input });

    const data = buildSettlementOrderData({
      settlement: s,
      input,
      existingCustomerId: "cus-from-hold",
    });
    expect(data.customerId).toBeNull();
  });
});

describe("posOrderSource — which channel a till sale is booked to", () => {
  it("is the delivery platform the cashier picked under Others", () => {
    expect(posOrderSource({ onlinePlatform: "GOFOOD" })).toBe("GOFOOD");
    expect(posOrderSource({ onlinePlatform: "UBER_EATS" })).toBe("UBER_EATS");
  });

  it("is POS for every Dine In / Take Away sale", () => {
    expect(posOrderSource({})).toBe("POS");
  });
});

describe("resolveStoreTableId — only this store's own tables", () => {
  beforeEach(() => prismaMock.table.findFirst.mockReset());

  it("links a table of this store, looked up scoped to the store", async () => {
    prismaMock.table.findFirst.mockResolvedValue({ id: "t1" });
    await expect(resolveStoreTableId("s1", "t1", "DINE_IN")).resolves.toBe("t1");
    expect(prismaMock.table.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1", storeId: "s1" } })
    );
  });

  it("drops another store's table (or a deleted one) instead of linking it", async () => {
    prismaMock.table.findFirst.mockResolvedValue(null);
    await expect(resolveStoreTableId("s1", "t_foreign", "DINE_IN")).resolves.toBeNull();
  });

  it("never links a table to a takeaway or platform order, and doesn't ask the database", async () => {
    await expect(resolveStoreTableId("s1", "t1", "TAKEAWAY")).resolves.toBeNull();
    await expect(resolveStoreTableId("s1", "t1", "DELIVERY")).resolves.toBeNull();
    await expect(resolveStoreTableId("s1", undefined, "DINE_IN")).resolves.toBeNull();
    expect(prismaMock.table.findFirst).not.toHaveBeenCalled();
  });
});
