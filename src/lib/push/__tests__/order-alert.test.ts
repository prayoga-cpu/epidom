import { describe, it, expect } from "vitest";
import { storefrontOrderPushPayload } from "../order-alert";

const base = {
  storeId: "store_1",
  orderId: "ord_1",
  orderNumber: "ORD-20261006-ABC123",
  customerName: "Ana",
};

describe("storefrontOrderPushPayload", () => {
  it("speaks the store's language, Indonesian by default", () => {
    expect(
      storefrontOrderPushPayload({ ...base, locale: null, queueNumber: 7, unpaid: true })
    ).toEqual({
      title: "Pesanan online baru · belum dibayar",
      body: "#7 · Ana — tagih pembayaran di kasir",
      url: "/store/store_1/pos/orders",
      tag: "order-ord_1",
    });
    expect(
      storefrontOrderPushPayload({ ...base, locale: "fr", queueNumber: 7, unpaid: true }).title
    ).toBe("Nouvelle commande en ligne · non payée");
  });

  it("falls back to the order number when the store has no queue number", () => {
    expect(
      storefrontOrderPushPayload({ ...base, locale: "en", queueNumber: null, unpaid: true }).body
    ).toBe("ORD-20261006-ABC123 · Ana — collect payment at the cashier");
  });

  it("drops the collect-at-cashier line for an order that is already paid", () => {
    const paid = storefrontOrderPushPayload({
      ...base,
      locale: "en",
      queueNumber: 7,
      unpaid: false,
    });
    expect(paid.title).toBe("New online order");
    expect(paid.body).toBe("#7 · Ana");
  });
});
