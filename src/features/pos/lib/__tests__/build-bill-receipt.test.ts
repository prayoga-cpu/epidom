import { describe, it, expect } from "vitest";
import { buildBillReceipt, type BillCartSnapshot } from "../build-bill-receipt";

const NOW = new Date("2026-09-19T14:05:00");

const cart: BillCartSnapshot = {
  items: [
    {
      id: "l1",
      menuItemId: "m1",
      name: "Ramen",
      unitPrice: 12.5,
      quantity: 2,
      modifiers: [{ groupName: "Spice", optionName: "Extra hot", priceAdjustment: 0.5 }],
      notes: "no egg",
      lineTotal: 26,
    },
    {
      id: "l2",
      menuItemId: null,
      isCustom: true,
      name: "Delivery fee",
      unitPrice: 3,
      quantity: 1,
      modifiers: [],
      lineTotal: 3,
      department: null,
    },
  ],
  subtotal: 24.27,
  tax: 2.43,
  serviceCharge: 2.3,
  discountAmount: 3,
  discountReason: "Member",
  total: 26,
  tableNumber: "A1",
};

const settings = {
  tagline: "Always fresh",
  address: "1 rue de Rivoli, Paris",
  email: "hi@cafe.fr",
  phone: "+33100000000",
  instagramHandle: "@cafe",
  tiktokHandle: "@cafetok",
  facebookHandle: "cafefb",
  footerMessage: "Merci !",
  showSocialLinks: true,
};

const build = (over: Partial<Parameters<typeof buildBillReceipt>[0]> = {}) =>
  buildBillReceipt({
    cart,
    storeName: "Café Rivoli",
    currency: "EUR",
    locale: "fr",
    receiptSettings: settings,
    taxLabel: "TVA",
    cashierName: "Léa",
    paperWidth: 32,
    orderNumber: "POS-20260919-ABC123",
    now: NOW,
    ...over,
  });

describe("buildBillReceipt", () => {
  it("is a provisional bill, not a receipt", () => {
    expect(build().documentType).toBe("bill");
  });

  it("carries no payment lines — nothing has been paid yet", () => {
    const bill = build();
    expect(bill.paymentMethod).toBe("");
    expect(bill.amountTendered).toBeUndefined();
    expect(bill.change).toBeUndefined();
    expect(bill.payments).toBeUndefined();
  });

  it("prints the lines with their option names, notes and totals", () => {
    const bill = build();
    expect(bill.items).toEqual([
      {
        name: "Ramen",
        quantity: 2,
        unitPrice: 12.5,
        total: 26,
        optionNames: ["Extra hot"],
        notes: "no egg",
      },
      {
        name: "Delivery fee",
        quantity: 1,
        unitPrice: 3,
        total: 3,
        optionNames: [],
        notes: undefined,
      },
    ]);
  });

  it("keeps every amount literal in the store's currency (no IDR conversion)", () => {
    const bill = build();
    expect(bill.currency).toBe("EUR");
    expect(bill.subtotal).toBe(24.27);
    expect(bill.total).toBe(26);
    expect(bill.tax).toBe(2.43);
    expect(bill.serviceCharge).toBe(2.3);
    expect(bill.discountAmount).toBe(3);
    expect(bill.discountReason).toBe("Member");
    expect(bill.taxLabel).toBe("TVA");
  });

  it("leaves tax, service charge and discount off the bill when they are zero", () => {
    const bill = build({
      cart: { ...cart, tax: 0, serviceCharge: 0, discountAmount: 0, discountReason: null },
    });
    expect(bill.tax).toBeUndefined();
    expect(bill.serviceCharge).toBeUndefined();
    expect(bill.discountAmount).toBeUndefined();
    expect(bill.discountReason).toBeUndefined();
  });

  it("mirrors the branding checkout's receipt prints", () => {
    const bill = build();
    expect(bill).toMatchObject({
      storeName: "Café Rivoli",
      locale: "fr",
      tagline: "Always fresh",
      address: "1 rue de Rivoli, Paris",
      email: "hi@cafe.fr",
      phone: "+33100000000",
      instagramHandle: "@cafe",
      tiktokHandle: "@cafetok",
      facebookHandle: "cafefb",
      footerMessage: "Merci !",
      cashierName: "Léa",
      width: 32,
    });
  });

  it("drops the social handles when the store turned them off", () => {
    const bill = build({ receiptSettings: { ...settings, showSocialLinks: false } });
    expect(bill.instagramHandle).toBeUndefined();
    expect(bill.tiktokHandle).toBeUndefined();
    expect(bill.facebookHandle).toBeUndefined();
    expect(bill.tagline).toBe("Always fresh");
  });

  it("prints the table when there is one, and nothing when there isn't", () => {
    expect(build().tableLabel).toBe("A1");
    expect(build({ cart: { ...cart, tableNumber: "" } }).tableLabel).toBeUndefined();
  });

  it("uses the saved bill's number for a resumed bill, a placeholder for a fresh one", () => {
    expect(build().orderNumber).toBe("POS-20260919-ABC123");
    expect(build({ orderNumber: null }).orderNumber).toBe("—");
    expect(build({ orderNumber: undefined }).orderNumber).toBe("—");
  });

  it("formats the date in the store's language", () => {
    const fr = build({ locale: "fr" }).date;
    const en = build({ locale: "en" }).date;
    expect(fr).toContain("19/09/2026");
    expect(en).toContain("9/19/26");
    expect(fr).not.toBe(en);
  });

  it("works with a bare-bones store: no receipt settings, no printer width", () => {
    const bill = build({
      receiptSettings: null,
      storeName: undefined,
      taxLabel: null,
      cashierName: undefined,
      paperWidth: undefined,
    });
    expect(bill.storeName).toBe("Epidom POS");
    expect(bill.tagline).toBeUndefined();
    expect(bill.taxLabel).toBeUndefined();
    expect(bill.cashierName).toBeUndefined();
    expect(bill.width).toBeUndefined();
    expect(bill.documentType).toBe("bill");
  });
});
