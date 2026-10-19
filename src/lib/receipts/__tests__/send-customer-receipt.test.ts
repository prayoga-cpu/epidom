/**
 * sendCustomerReceiptForOrder — phone validation, send-limit, and per-order guards.
 *
 * WhatsApp API sending via Fonnte has been removed. The function now always
 * returns `whatsapp_not_configured` after passing validation and the send-limit
 * check. The wa.me link flow (send-receipt-whatsapp.tsx) is the supported path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

var prismaMock: any;
var buildReceiptMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    orderReceiptSend: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/receipts/build-receipt-data", () => {
  buildReceiptMock = vi.fn();
  return { buildReceiptData: buildReceiptMock };
});

import { sendCustomerReceiptForOrder } from "../send-customer-receipt";
import { MAX_RECEIPT_SENDS_PER_ORDER } from "../receipt-send-limit";

function built(overrides: Record<string, unknown> = {}) {
  return {
    receipt: { storeName: "Warung Kopi", total: 100, currency: "EUR", locale: "fr" },
    orderId: "order-1",
    storeId: "store-1",
    storefrontSlug: null,
    customerPhone: "+33612345678",
    customerName: "Claire",
    paymentStatus: "PAID",
    autoSendWhatsappReceipt: true,
    orderDate: new Date("2026-09-19T10:00:00.000Z"),
    ...overrides,
  };
}

const OPTS = { skipAutoSendGate: true, skipAlreadySentGuard: true };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.orderReceiptSend.count.mockResolvedValue(0);
  buildReceiptMock.mockResolvedValue(built());
});

describe("phone override normalisation", () => {
  it("normalises a national number to E.164 and then returns whatsapp_not_configured", async () => {
    const result = await sendCustomerReceiptForOrder("order-1", {
      ...OPTS,
      phoneOverride: "06 12 34 56 78",
    });
    // Phone passed validation (not invalid_phone), hits the no-sender wall
    expect(result).toEqual({ sent: false, skipped: true, reason: "whatsapp_not_configured" });
  });

  it("rejects anything that cannot be made into E.164, and sends nothing", async () => {
    for (const bad of ["not-a-phone", "+++++", "12345678901234567890"]) {
      const result = await sendCustomerReceiptForOrder("order-1", {
        ...OPTS,
        phoneOverride: bad,
      });
      expect(result).toEqual({ sent: false, skipped: true, reason: "invalid_phone" });
    }
    expect(prismaMock.orderReceiptSend.create).not.toHaveBeenCalled();
  });

  it("still reports a missing number as such, not as invalid", async () => {
    buildReceiptMock.mockResolvedValue(built({ customerPhone: null }));
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toMatchObject({ reason: "no_customer_phone" });
  });
});

describe("per-order send cap", () => {
  it("refuses once the order has used its allowance", async () => {
    prismaMock.orderReceiptSend.count.mockResolvedValue(MAX_RECEIPT_SENDS_PER_ORDER);
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toEqual({ sent: false, skipped: true, reason: "send_limit_reached" });
  });

  it("counts every channel", async () => {
    await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(prismaMock.orderReceiptSend.count).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
    });
  });
});

describe("existing guards", () => {
  it("refuses an order belonging to another store", async () => {
    const result = await sendCustomerReceiptForOrder("order-1", {
      ...OPTS,
      expectedStoreId: "store-2",
    });
    expect(result).toMatchObject({ reason: "order_not_found" });
  });

  it("refuses an unpaid order", async () => {
    buildReceiptMock.mockResolvedValue(built({ paymentStatus: "PENDING" }));
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toMatchObject({ reason: "not_paid" });
  });

  it("returns whatsapp_not_configured — never writes a send log row", async () => {
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toEqual({ sent: false, skipped: true, reason: "whatsapp_not_configured" });
    expect(prismaMock.orderReceiptSend.create).not.toHaveBeenCalled();
  });
});
