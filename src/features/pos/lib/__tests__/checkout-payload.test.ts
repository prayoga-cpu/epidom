import { describe, it, expect } from "vitest";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { normalizeTenders } from "@/lib/finance/order-payments";
import {
  buildCheckoutPayload,
  cashChangeOf,
  settledPaymentFromServer,
  type BuildCheckoutPayloadInput,
  type CheckoutDiscountInput,
} from "../checkout-payload";
import type { CartItem } from "../../types/pos.types";

// cuid-shaped ids: the order schema validates them with z.string().cuid().
const RAMEN_ID = "ckramen000000000000000001";
const CUSTOMER_ID = "ckcust0000000000000000001";
const PRESET_ID = "ckpreset00000000000000001";

const ramen: CartItem = {
  id: "line-1",
  menuItemId: RAMEN_ID,
  name: "Ramen",
  unitPrice: 12,
  quantity: 2,
  modifiers: [{ groupName: "Spice", optionName: "Hot", priceAdjustment: 0.5 }],
  notes: "no egg",
  lineTotal: 25,
};

const gift: CartItem = {
  id: "line-2",
  menuItemId: null,
  isCustom: true,
  name: "Gift wrap",
  unitPrice: 3,
  quantity: 1,
  modifiers: [],
  department: "BAR",
  lineTotal: 3,
};

const noDiscount: CheckoutDiscountInput = {
  source: null,
  primaryAmount: 0,
  totalAmount: 0,
  totalReason: null,
  redeemPoints: 0,
};

function input(over: Partial<BuildCheckoutPayloadInput> = {}): BuildCheckoutPayloadInput {
  return {
    items: [ramen],
    orderType: "DINE_IN",
    guestCount: 2,
    tableNumber: "A1",
    customer: null,
    notes: "",
    discount: noDiscount,
    payment: { kind: "single", method: "CASH", amountTendered: 30 },
    offline: false,
    ...over,
  };
}

describe("buildCheckoutPayload — legacy single-method sale", () => {
  it("sends exactly the legacy fields and never payments[]", () => {
    expect(buildCheckoutPayload(input({ shiftId: "ckshift00000000000000001" }))).toStrictEqual({
      items: [
        {
          menuItemId: RAMEN_ID,
          name: "Ramen",
          quantity: 2,
          unitPrice: 12,
          selectedOptions: [{ groupName: "Spice", optionName: "Hot", priceAdjustment: 0.5 }],
          notes: "no egg",
        },
      ],
      orderType: "DINE_IN",
      guestCount: 2,
      tableNumber: "A1",
      shiftId: "ckshift00000000000000001",
      paymentMethod: "CASH",
      amountTendered: 30,
    });
  });

  it("only carries the method-specific legacy fields for the method chosen", () => {
    const qris = buildCheckoutPayload(
      input({ payment: { kind: "single", method: "QRIS", amountTendered: 99, paymentNote: "x" } })
    );
    expect(qris.paymentMethod).toBe("QRIS");
    expect(qris).not.toHaveProperty("amountTendered");
    expect(qris).not.toHaveProperty("paymentNote");
    expect(qris).not.toHaveProperty("payments");

    const other = buildCheckoutPayload(
      input({ payment: { kind: "single", method: "OTHER", paymentNote: " Crypto " } })
    );
    expect(other.paymentMethod).toBe("OTHER");
    expect(other.paymentNote).toBe("Crypto");

    const bank = buildCheckoutPayload(
      input({ payment: { kind: "single", method: "BANK_TRANSFER", bankCode: "BRI" } })
    );
    expect(bank.bankCode).toBe("BRI");

    const later = buildCheckoutPayload(input({ payment: { kind: "single", method: "PAY_LATER" } }));
    expect(later.paymentMethod).toBe("PAY_LATER");
  });

  it("sends pax for dine-in only", () => {
    expect(
      buildCheckoutPayload(input({ orderType: "TAKEAWAY", guestCount: 3 }))
    ).not.toHaveProperty("guestCount");
    expect(buildCheckoutPayload(input({ guestCount: null }))).not.toHaveProperty("guestCount");
  });

  it("omits blank table / notes rather than sending empty strings", () => {
    const body = buildCheckoutPayload(input({ tableNumber: "  ", notes: "" }));
    expect(body).not.toHaveProperty("tableNumber");
    expect(body).not.toHaveProperty("notes");
  });

  it("maps a Custom Item to a custom line with its prep area", () => {
    const body = buildCheckoutPayload(input({ items: [gift] }));
    expect(body.items).toStrictEqual([
      { custom: true, name: "Gift wrap", quantity: 1, unitPrice: 3, department: "BAR" },
    ]);
  });

  it("a Custom Item with no prep area sends department null", () => {
    const body = buildCheckoutPayload(input({ items: [{ ...gift, department: undefined }] }));
    expect(body.items[0]).toMatchObject({ custom: true, department: null });
  });
});

describe("buildCheckoutPayload — customer", () => {
  const alice = { id: CUSTOMER_ID, name: "Alice", phone: "+33612345678" };

  it("sends the customer id plus the free-text name/phone the receipt needs", () => {
    const body = buildCheckoutPayload(input({ customer: alice }));
    expect(body).toMatchObject({
      customerId: CUSTOMER_ID,
      customerName: "Alice",
      customerPhone: "+33612345678",
    });
  });

  it("falls back to a number typed on the customer display when the customer has none", () => {
    const body = buildCheckoutPayload(
      input({ customer: { ...alice, phone: null }, fallbackPhone: "+6281234567890" })
    );
    expect(body.customerPhone).toBe("+6281234567890");
    // Without an attached customer the fallback is still sent.
    expect(buildCheckoutPayload(input({ fallbackPhone: "+6281" })).customerPhone).toBe("+6281");
  });

  it("sends an email typed on the customer display as customerEmail, and nothing when there is none", () => {
    expect(
      buildCheckoutPayload(input({ fallbackEmail: " claire@example.com " })).customerEmail
    ).toBe("claire@example.com");
    expect(buildCheckoutPayload(input({ fallbackEmail: "" })).customerEmail).toBeUndefined();
    expect(buildCheckoutPayload(input({ fallbackEmail: null })).customerEmail).toBeUndefined();
    expect(buildCheckoutPayload(input()).customerEmail).toBeUndefined();
  });
});

describe("buildCheckoutPayload — discounts are re-priced by the server, never sent as amounts", () => {
  it("manual → discountAmount + discountReason (as before)", () => {
    const body = buildCheckoutPayload(
      input({
        discount: {
          ...noDiscount,
          source: { kind: "manual", amount: 5, reason: "Staff meal" },
          primaryAmount: 5,
          totalAmount: 5,
          totalReason: "Staff meal",
        },
      })
    );
    expect(body).toMatchObject({ discountAmount: 5, discountReason: "Staff meal" });
    expect(body).not.toHaveProperty("presetId");
  });

  it("manual sends only its own part when points are also redeemed", () => {
    const body = buildCheckoutPayload(
      input({
        customer: { id: CUSTOMER_ID, name: "Alice", phone: null },
        discount: {
          source: { kind: "manual", amount: 5, reason: "Staff meal" },
          primaryAmount: 5,
          totalAmount: 8,
          totalReason: "Staff meal + 300 pts",
          redeemPoints: 300,
        },
      })
    );
    expect(body.discountAmount).toBe(5);
    expect(body.discountReason).toBe("Staff meal");
    expect(body.redeemPoints).toBe(300);
  });

  it("preset → presetId only", () => {
    const body = buildCheckoutPayload(
      input({
        discount: {
          ...noDiscount,
          source: {
            kind: "preset",
            presetId: PRESET_ID,
            name: "Member",
            type: "PERCENT",
            value: 10,
          },
          primaryAmount: 2.5,
          totalAmount: 2.5,
          totalReason: "Member",
        },
      })
    );
    expect(body.presetId).toBe(PRESET_ID);
    expect(body).not.toHaveProperty("discountAmount");
    expect(body).not.toHaveProperty("discountReason");
  });

  it("coupon → couponCode only", () => {
    const body = buildCheckoutPayload(
      input({
        discount: {
          ...noDiscount,
          source: {
            kind: "coupon",
            couponId: "ckcoupon0000000000000001",
            code: "SAVE10",
            type: "FIXED",
            value: 10,
            minSubtotal: null,
          },
          primaryAmount: 10,
          totalAmount: 10,
          totalReason: "SAVE10",
        },
      })
    );
    expect(body.couponCode).toBe("SAVE10");
    expect(body).not.toHaveProperty("discountAmount");
    expect(body).not.toHaveProperty("presetId");
  });

  it("points need a customer id — without one they are not sent", () => {
    const withPoints: CheckoutDiscountInput = { ...noDiscount, redeemPoints: 200 };
    expect(buildCheckoutPayload(input({ discount: withPoints }))).not.toHaveProperty(
      "redeemPoints"
    );
    expect(
      buildCheckoutPayload(
        input({ customer: { id: CUSTOMER_ID, name: "A", phone: null }, discount: withPoints })
      ).redeemPoints
    ).toBe(200);
  });

  it("a split bill's share is a flat amount, never a preset the server would re-price in full", () => {
    const body = buildCheckoutPayload(
      input({
        splitGroupId: "grp12345",
        discount: {
          source: {
            kind: "preset",
            presetId: PRESET_ID,
            name: "Fixed 10",
            type: "FIXED",
            value: 10,
          },
          primaryAmount: 10,
          totalAmount: 10,
          totalReason: "Fixed 10",
          redeemPoints: 0,
          flat: { amount: 4, reason: "Fixed 10" },
        },
      })
    );
    expect(body).toMatchObject({
      discountAmount: 4,
      discountReason: "Fixed 10",
      splitGroupId: "grp12345",
    });
    expect(body).not.toHaveProperty("presetId");
    expect(body).not.toHaveProperty("redeemPoints");
  });
});

describe("buildCheckoutPayload — offline downgrade", () => {
  const discount: CheckoutDiscountInput = {
    source: {
      kind: "coupon",
      couponId: "ckcoupon0000000000000001",
      code: "SAVE10",
      type: "FIXED",
      value: 10,
      minSubtotal: null,
    },
    primaryAmount: 10,
    totalAmount: 13,
    totalReason: "SAVE10 + 300 pts",
    redeemPoints: 300,
  };
  const alice = { id: CUSTOMER_ID, name: "Alice", phone: "+33612345678" };

  it("drops customerId / preset / coupon / points and keeps a flat discount with its reason", () => {
    const body = buildCheckoutPayload(input({ offline: true, customer: alice, discount }));
    expect(body).toStrictEqual({
      items: expect.any(Array),
      orderType: "DINE_IN",
      guestCount: 2,
      tableNumber: "A1",
      // The free-text customer survives — receipts and WhatsApp still work.
      customerName: "Alice",
      customerPhone: "+33612345678",
      discountAmount: 13,
      discountReason: "SAVE10 + 300 pts",
      paymentMethod: "CASH",
      amountTendered: 30,
    });
    for (const dropped of ["customerId", "presetId", "couponCode", "redeemPoints"]) {
      expect(body).not.toHaveProperty(dropped);
    }
  });

  it("stays a legacy single-method payload (offline queue compatibility)", () => {
    const body = buildCheckoutPayload(input({ offline: true }));
    expect(body).not.toHaveProperty("payments");
    expect(body.paymentMethod).toBe("CASH");
  });
});

describe("buildCheckoutPayload — split payment", () => {
  const check = normalizeTenders(30, [
    { method: "CASH", amount: 20, amountTendered: 50 },
    { method: "QRIS", amount: 5 },
    { method: "OTHER", amount: 5, note: "Voucher" },
  ]);
  if (!check.ok) throw new Error("fixture must normalize");

  it("sends payments[] and none of the legacy payment fields", () => {
    const body = buildCheckoutPayload(
      input({ payment: { kind: "split", tenders: check.tenders } })
    );
    expect(body.payments).toStrictEqual([
      { method: "CASH", amount: 20, amountTendered: 50 },
      { method: "QRIS", amount: 5 },
      { method: "OTHER", amount: 5, note: "Voucher" },
    ]);
    for (const legacy of ["paymentMethod", "amountTendered", "paymentNote", "bankCode"]) {
      expect(body).not.toHaveProperty(legacy);
    }
  });

  it("carries the split group id and pax for a split bill", () => {
    const body = buildCheckoutPayload(
      input({ payment: { kind: "split", tenders: check.tenders }, splitGroupId: "grp12345" })
    );
    expect(body.splitGroupId).toBe("grp12345");
  });
});

describe("every payload shape validates against the server's own order schema", () => {
  const alice = { id: CUSTOMER_ID, name: "Alice", phone: "+33612345678" };
  const tenders = normalizeTenders(25, [
    { method: "CASH", amount: 10, amountTendered: 10 },
    { method: "STRIPE_CARD", amount: 15 },
  ]);
  if (!tenders.ok) throw new Error("fixture must normalize");

  const cases: Array<[string, BuildCheckoutPayloadInput]> = [
    ["legacy cash", input()],
    ["legacy pay later", input({ payment: { kind: "single", method: "PAY_LATER" } })],
    ["custom item", input({ items: [ramen, gift] })],
    ["split", input({ payment: { kind: "split", tenders: tenders.tenders } })],
    [
      "customer + points",
      input({ customer: alice, discount: { ...noDiscount, redeemPoints: 100 } }),
    ],
    [
      "offline downgrade",
      input({
        offline: true,
        customer: alice,
        discount: { ...noDiscount, totalAmount: 4, totalReason: "x" },
      }),
    ],
  ];

  it.each(cases)("%s", (_name, arg) => {
    const parsed = createPosOrderSchema.safeParse(buildCheckoutPayload(arg));
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });
});

describe("cashChangeOf", () => {
  it("single cash: tendered minus total, zero when exact, null when there is no hand-over", () => {
    expect(cashChangeOf({ kind: "single", method: "CASH", amountTendered: 30 }, 25)).toBe(5);
    expect(cashChangeOf({ kind: "single", method: "CASH", amountTendered: 25 }, 25)).toBe(0);
    expect(cashChangeOf({ kind: "single", method: "CASH" }, 25)).toBeNull();
    expect(cashChangeOf({ kind: "single", method: "QRIS" }, 25)).toBeNull();
  });

  it("split: the change across cash tenders, null when no cash row had a hand-over", () => {
    const withCash = normalizeTenders(30, [
      { method: "CASH", amount: 20, amountTendered: 50 },
      { method: "QRIS", amount: 10 },
    ]);
    const withoutCash = normalizeTenders(30, [
      { method: "CASH", amount: 20 },
      { method: "QRIS", amount: 10 },
    ]);
    if (!withCash.ok || !withoutCash.ok) throw new Error("fixture");
    expect(cashChangeOf({ kind: "split", tenders: withCash.tenders }, 30)).toBe(30);
    expect(cashChangeOf({ kind: "split", tenders: withoutCash.tenders }, 30)).toBeNull();
  });
});

describe("settledPaymentFromServer", () => {
  const submitted = { kind: "single", method: "CASH", amountTendered: 30 } as const;

  it("falls back to what was submitted when the server returned no tenders", () => {
    expect(settledPaymentFromServer(undefined, submitted)).toBe(submitted);
    expect(settledPaymentFromServer([], submitted)).toBe(submitted);
  });

  it("one server tender becomes a single payment", () => {
    const settled = settledPaymentFromServer(
      [{ method: "OTHER", amount: 25, amountTendered: null, change: null, note: "Crypto" }],
      submitted
    );
    expect(settled).toMatchObject({ kind: "single", method: "OTHER", paymentNote: "Crypto" });
  });

  it("two or more server tenders become a split", () => {
    const settled = settledPaymentFromServer(
      [
        { method: "CASH", amount: 10, amountTendered: 20, change: 10, note: null },
        { method: "QRIS", amount: 15, amountTendered: null, change: null, note: null },
      ],
      submitted
    );
    expect(settled.kind).toBe("split");
    expect(cashChangeOf(settled, 25)).toBe(10);
  });
});
