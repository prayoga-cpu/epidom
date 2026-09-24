/**
 * POS Validation Schemas Tests
 *
 * Tests for updateOrderStatusSchema, in particular the "mark as paid" fields
 * (paymentMethod/paymentNote) added alongside the settle-payment dialog.
 */

import { describe, it, expect } from "vitest";
import {
  updateOrderStatusSchema,
  settlePaymentMethodEnum,
  createPosOrderSchema,
  createHoldOrderSchema,
  mergeOrdersSchema,
} from "../pos.schemas";

describe("updateOrderStatusSchema", () => {
  it("accepts a plain status update", () => {
    const result = updateOrderStatusSchema.safeParse({ status: "CONFIRMED" });
    expect(result.success).toBe(true);
  });

  it("accepts marking paid with a settle payment method and note", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      paymentNote: "Client paid directly to the owner",
    });
    expect(result.success).toBe(true);
  });

  it("accepts marking paid with no payment method/note (both optional)", () => {
    const result = updateOrderStatusSchema.safeParse({ paymentStatus: "PAID" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither status nor paymentStatus is provided", () => {
    const result = updateOrderStatusSchema.safeParse({ paymentMethod: "CASH" });
    expect(result.success).toBe(false);
  });

  it("rejects a paymentMethod without paymentStatus: PAID", () => {
    const result = updateOrderStatusSchema.safeParse({
      status: "CONFIRMED",
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PAY_LATER as a settle payment method", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentMethod: "PAY_LATER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a paymentNote over 300 characters", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentNote: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

describe("guestCount", () => {
  const baseOrder = {
    items: [
      {
        menuItemId: "clh1234567890abcdefghijkl",
        name: "Latte",
        quantity: 1,
        unitPrice: 25000,
      },
    ],
    paymentMethod: "CASH" as const,
    orderType: "DINE_IN" as const,
  };

  it("accepts a pax count within bounds", () => {
    expect(createPosOrderSchema.safeParse({ ...baseOrder, guestCount: 4 }).success).toBe(true);
  });

  it("is optional — omitting it means 'not recorded', not zero", () => {
    const result = createPosOrderSchema.safeParse(baseOrder);
    expect(result.success).toBe(true);
    expect(result.success && result.data.guestCount).toBeUndefined();
  });

  it("rejects zero and negative counts", () => {
    expect(createPosOrderSchema.safeParse({ ...baseOrder, guestCount: 0 }).success).toBe(false);
    expect(createPosOrderSchema.safeParse({ ...baseOrder, guestCount: -1 }).success).toBe(false);
  });

  it("rejects a fractional pax count", () => {
    expect(createPosOrderSchema.safeParse({ ...baseOrder, guestCount: 2.5 }).success).toBe(false);
  });

  it("rejects an implausibly large count", () => {
    expect(createPosOrderSchema.safeParse({ ...baseOrder, guestCount: 100 }).success).toBe(false);
  });

  it("is accepted on a hold too, so a dine-in hold carries pax to finalize", () => {
    const result = createHoldOrderSchema.safeParse({
      items: baseOrder.items,
      orderType: "DINE_IN",
      guestCount: 6,
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.guestCount).toBe(6);
  });
});

/**
 * BACKWARD COMPATIBILITY IS A MONEY GUARANTEE, NOT A NICETY.
 *
 * The POS offline queue persists the raw request body to IndexedDB
 * UNVERSIONED and DELETES the entry after 5 failed replays. A payload that
 * starts being rejected is therefore a PAID SALE that disappears. Every
 * fixture below is a literal, hand-written copy of a pre-2.88.0 body — not
 * built from the schema — so a future edit that tightens the contract fails
 * here instead of in a merchant's till.
 */
describe("createPosOrderSchema — legacy payload compatibility", () => {
  it("accepts the minimal pre-multi-tender cash payload", () => {
    const legacy = {
      items: [
        {
          menuItemId: "clh1234567890abcdefghijkl",
          name: "Latte",
          quantity: 1,
          unitPrice: 25000,
        },
      ],
      paymentMethod: "CASH",
      orderType: "TAKEAWAY",
    };
    const result = createPosOrderSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    expect(result.success && result.data.payments).toBeUndefined();
  });

  it("accepts a fully-populated legacy offline-queue payload", () => {
    const legacy = {
      items: [
        {
          menuItemId: "clh1234567890abcdefghijkl",
          name: "Coffee",
          quantity: 2,
          unitPrice: 20000,
          selectedOptions: [
            {
              groupName: "Size",
              optionName: "Large",
              priceAdjustment: 5000,
              materialId: "clh1234567890abcdefghijmm",
              materialQty: 5,
            },
          ],
          notes: "no ice",
        },
      ],
      paymentMethod: "OTHER",
      paymentNote: "Company account",
      orderType: "DINE_IN",
      guestCount: 3,
      tableId: "clh1234567890abcdefghijnn",
      tableNumber: "12",
      customerName: "Budi",
      customerPhone: "+628123456789",
      notes: "birthday",
      amountTendered: 60000,
      shiftId: "clh1234567890abcdefghijoo",
      discountAmount: 5000,
      discountReason: "Staff discount",
      clientRequestId: "queue-entry-1",
    };
    const result = createPosOrderSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    expect(result.success && result.data.paymentMethod).toBe("OTHER");
    expect(result.success && result.data.amountTendered).toBe(60000);
  });

  it("still requires paymentNote when the legacy paymentMethod is OTHER", () => {
    const result = createPosOrderSchema.safeParse({
      items: [
        { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 1 },
      ],
      paymentMethod: "OTHER",
      orderType: "DINE_IN",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the legacy PAY_LATER payload", () => {
    const result = createPosOrderSchema.safeParse({
      items: [
        { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 1 },
      ],
      paymentMethod: "PAY_LATER",
      orderType: "DINE_IN",
    });
    expect(result.success).toBe(true);
  });
});

describe("createPosOrderSchema — custom items", () => {
  const base = {
    paymentMethod: "CASH" as const,
    orderType: "TAKEAWAY" as const,
  };

  it("accepts a Custom Item line with a prep area", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      items: [
        {
          custom: true,
          name: "Birthday cake slice",
          quantity: 1,
          unitPrice: 30000,
          department: "KITCHEN",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Custom Item with department null (no prep area)", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      items: [{ custom: true, name: "Corkage", quantity: 1, unitPrice: 50000, department: null }],
    });
    expect(result.success).toBe(true);
  });

  it("mixes custom and menu lines in one cart", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      items: [
        { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 25000 },
        { custom: true, name: "Tip jar", quantity: 1, unitPrice: 10000 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.items).toHaveLength(2);
  });

  it("rejects a custom line with no name, a zero price, or an absurd price", () => {
    const bad = (item: unknown) =>
      createPosOrderSchema.safeParse({ ...base, items: [item] }).success;
    expect(bad({ custom: true, name: "", quantity: 1, unitPrice: 1000 })).toBe(false);
    expect(bad({ custom: true, name: "x".repeat(81), quantity: 1, unitPrice: 1000 })).toBe(false);
    expect(bad({ custom: true, name: "Thing", quantity: 1, unitPrice: 0 })).toBe(false);
    expect(bad({ custom: true, name: "Thing", quantity: 1, unitPrice: 100_000_001 })).toBe(false);
  });

  it("rejects a line that is neither a menu line nor a custom line", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      items: [{ name: "Mystery", quantity: 1, unitPrice: 1000 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("createPosOrderSchema — cashier revamp fields", () => {
  const base = {
    items: [
      { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 25000 },
    ],
    orderType: "TAKEAWAY" as const,
  };

  it("accepts a multi-tender payload with no paymentMethod at all", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      payments: [
        { method: "CASH", amount: 20000, amountTendered: 25000 },
        { method: "QRIS", amount: 5000 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.payments).toHaveLength(2);
  });

  it("rejects a payload with neither paymentMethod nor payments", () => {
    expect(createPosOrderSchema.safeParse(base).success).toBe(false);
  });

  it("rejects PAY_LATER and SPLIT as a tender method", () => {
    const withMethod = (method: string) =>
      createPosOrderSchema.safeParse({ ...base, payments: [{ method, amount: 1000 }] }).success;
    expect(withMethod("PAY_LATER")).toBe(false);
    expect(withMethod("SPLIT")).toBe(false);
    expect(withMethod("CASH")).toBe(true);
  });

  it("caps the tender list at ten rows", () => {
    const tenders = Array.from({ length: 11 }, () => ({ method: "CASH", amount: 100 }));
    expect(createPosOrderSchema.safeParse({ ...base, payments: tenders }).success).toBe(false);
  });

  it("requires customerId alongside redeemPoints", () => {
    expect(
      createPosOrderSchema.safeParse({ ...base, paymentMethod: "CASH", redeemPoints: 50 }).success
    ).toBe(false);
    expect(
      createPosOrderSchema.safeParse({
        ...base,
        paymentMethod: "CASH",
        customerId: "clh1234567890abcdefghijpp",
        redeemPoints: 50,
      }).success
    ).toBe(true);
  });

  it("accepts presetId, couponCode and splitGroupId", () => {
    const result = createPosOrderSchema.safeParse({
      ...base,
      paymentMethod: "CASH",
      presetId: "clh1234567890abcdefghijqq",
      couponCode: "save10",
      splitGroupId: "split-1234",
    });
    expect(result.success).toBe(true);
  });

  it("constrains splitGroupId to a bounded opaque token", () => {
    const withGroup = (splitGroupId: string) =>
      createPosOrderSchema.safeParse({ ...base, paymentMethod: "CASH", splitGroupId }).success;

    // The shapes the client actually generates (nanoid / uuid).
    expect(withGroup("V1StGXR8_Z5jdHi6B-myT")).toBe(true);
    expect(withGroup("6f3b1c22-4a1d-4c1e-9f0a-2b9d8e7c6a5b")).toBe(true);
    // It is echoed into responses and grouped on in history queries, so it is
    // never free text.
    expect(withGroup("split 1234")).toBe(false);
    expect(withGroup("<script>")).toBe(false);
    expect(withGroup("a".repeat(65))).toBe(false);
  });

  /**
   * Three-state, and the difference is money: OMITTED keeps the customer a
   * resumed hold already attached (dropping it silently costs them their
   * loyalty points), an explicit null detaches.
   */
  it("distinguishes an omitted customerId from an explicit null", () => {
    const omitted = createPosOrderSchema.safeParse({ ...base, paymentMethod: "CASH" });
    expect(omitted.success && omitted.data.customerId).toBeUndefined();

    const detached = createPosOrderSchema.safeParse({
      ...base,
      paymentMethod: "CASH",
      customerId: null,
    });
    expect(detached.success).toBe(true);
    expect(detached.success && detached.data.customerId).toBeNull();
  });

  it("does not let a null customerId smuggle a points redemption through", () => {
    expect(
      createPosOrderSchema.safeParse({
        ...base,
        paymentMethod: "CASH",
        customerId: null,
        redeemPoints: 50,
      }).success
    ).toBe(false);
  });

  it("rejects a fractional or zero points redemption", () => {
    const redeem = (redeemPoints: number) =>
      createPosOrderSchema.safeParse({
        ...base,
        paymentMethod: "CASH",
        customerId: "clh1234567890abcdefghijpp",
        redeemPoints,
      }).success;
    expect(redeem(0)).toBe(false);
    expect(redeem(1.5)).toBe(false);
    expect(redeem(1)).toBe(true);
  });
});

describe("createHoldOrderSchema — cashier revamp fields", () => {
  const base = {
    items: [
      { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 25000 },
    ],
    orderType: "DINE_IN" as const,
  };

  it("still accepts the old hold payload untouched", () => {
    const result = createHoldOrderSchema.safeParse({
      ...base,
      tableNumber: "5",
      customerName: "Walk-in",
      notes: "no onions",
    });
    expect(result.success).toBe(true);
  });

  it("distinguishes an omitted customerId/presetId from an explicit null", () => {
    // A re-hold that says nothing keeps what the bill had; null detaches.
    const omitted = createHoldOrderSchema.safeParse(base);
    expect(omitted.success && "customerId" in omitted.data).toBe(false);

    const detached = createHoldOrderSchema.safeParse({
      ...base,
      customerId: null,
      presetId: null,
    });
    expect(detached.success).toBe(true);
    expect(detached.success && detached.data.customerId).toBeNull();
    expect(detached.success && detached.data.presetId).toBeNull();
  });

  it("accepts the customer and discount a Save Bill now carries", () => {
    const result = createHoldOrderSchema.safeParse({
      ...base,
      customerId: "clh1234567890abcdefghijpp",
      customerPhone: "+33612345678",
      presetId: "clh1234567890abcdefghijqq",
      discountAmount: 2500,
      discountReason: "Happy hour",
    });
    expect(result.success).toBe(true);
  });

  it("inherits custom items from the order schema's items shape", () => {
    const result = createHoldOrderSchema.safeParse({
      ...base,
      items: [{ custom: true, name: "Corkage", quantity: 1, unitPrice: 50000 }],
    });
    expect(result.success).toBe(true);
  });

  it("does not accept a coupon or points — neither is redeemed at hold time", () => {
    const parsed = createHoldOrderSchema.safeParse({
      ...base,
      couponCode: "SAVE10",
      redeemPoints: 10,
    });
    // Unknown keys are stripped rather than rejected, which is the point:
    // a hold can never consume a coupon use or a points balance.
    expect(parsed.success).toBe(true);
    expect(parsed.success && "couponCode" in parsed.data).toBe(false);
    expect(parsed.success && "redeemPoints" in parsed.data).toBe(false);
  });
});

describe("mergeOrdersSchema", () => {
  const id = (suffix: string) => `clh1234567890abcdefghi${suffix}`;

  it("accepts a target and up to ten sources", () => {
    const sources = Array.from({ length: 10 }, (_, i) => id(`s${i}z`));
    expect(
      mergeOrdersSchema.safeParse({ targetOrderId: id("tgt"), sourceOrderIds: sources }).success
    ).toBe(true);
  });

  it("rejects an empty or oversized source list", () => {
    expect(
      mergeOrdersSchema.safeParse({ targetOrderId: id("tgt"), sourceOrderIds: [] }).success
    ).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => id(`s${i}z`));
    expect(
      mergeOrdersSchema.safeParse({ targetOrderId: id("tgt"), sourceOrderIds: eleven }).success
    ).toBe(false);
  });
});

describe("settlePaymentMethodEnum", () => {
  it("excludes PAY_LATER from the settle-payment options", () => {
    expect(settlePaymentMethodEnum.options).not.toContain("PAY_LATER");
  });

  it("still offers every real payment method", () => {
    expect(settlePaymentMethodEnum.options).toEqual([
      "CASH",
      "QRIS",
      "GOPAY",
      "OVO",
      "DANA",
      "SHOPEEPAY",
      "BANK_TRANSFER",
      "STRIPE_CARD",
      "LINKAJA",
      "CHEQUE",
      "TITRE_RESTAURANT",
      "PAYPAL",
      "APPLE_PAY",
      "GOOGLE_PAY",
      "OTHER",
    ]);
  });
});

describe('online platform orders (the till\'s "Others")', () => {
  const items = [
    { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 25000 },
  ];

  it("accepts a DELIVERY that names its platform, on checkout and on Save Bill", () => {
    const order = {
      items,
      orderType: "DELIVERY",
      onlinePlatform: "GOFOOD",
      paymentMethod: "OTHER",
      paymentNote: "GoFood",
    };
    expect(createPosOrderSchema.safeParse(order).success).toBe(true);
    expect(
      createHoldOrderSchema.safeParse({ items, orderType: "DELIVERY", onlinePlatform: "UBER_EATS" })
        .success
    ).toBe(true);
  });

  it("rejects a DELIVERY with no platform — the till has no other delivery flow", () => {
    expect(
      createPosOrderSchema.safeParse({ items, orderType: "DELIVERY", paymentMethod: "CASH" })
        .success
    ).toBe(false);
    expect(createHoldOrderSchema.safeParse({ items, orderType: "DELIVERY" }).success).toBe(false);
  });

  it("rejects a platform on a Dine In or Take Away sale", () => {
    const result = createPosOrderSchema.safeParse({
      items,
      orderType: "TAKEAWAY",
      onlinePlatform: "GRABFOOD",
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].path).toEqual(["onlinePlatform"]);
  });

  it("rejects a platform the till can't record (not an order source it knows)", () => {
    expect(
      createPosOrderSchema.safeParse({
        items,
        orderType: "DELIVERY",
        onlinePlatform: "TOKOPEDIA",
        paymentMethod: "CASH",
      }).success
    ).toBe(false);
  });

  it("an old Dine In / Take Away payload (no platform) still parses — offline queues hold them", () => {
    expect(
      createPosOrderSchema.safeParse({ items, orderType: "DINE_IN", paymentMethod: "CASH" }).success
    ).toBe(true);
    expect(createHoldOrderSchema.safeParse({ items, orderType: "TAKEAWAY" }).success).toBe(true);
  });
});
