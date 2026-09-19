/**
 * Manual "send this receipt to…" path.
 *
 * Two things here are security, not formatting: the typed-in phone override is
 * untrusted input on its way to an outbound gateway and into the send log, and
 * an uncapped send turns one paid order into a free relay that spends the
 * store's Fonnte credit and its sender reputation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var notifyMock: any;
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

vi.mock("@/lib/notifications/providers/fonnte", () => ({ isFonnteAvailable: () => true }));

vi.mock("@/lib/notifications", () => {
  notifyMock = vi.fn().mockResolvedValue({ fonnteMessageId: "msg-1" });
  return { notifyCustomerReceipt: notifyMock };
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
  prismaMock.orderReceiptSend.create.mockResolvedValue({});
  notifyMock.mockResolvedValue({ fonnteMessageId: "msg-1" });
  buildReceiptMock.mockResolvedValue(built());
});

describe("phone override normalisation", () => {
  it("normalises a national number to E.164 using the store's currency", async () => {
    // EUR -> +33. What reaches the gateway and the send log is canonical, not
    // whatever punctuation the cashier happened to type.
    const result = await sendCustomerReceiptForOrder("order-1", {
      ...OPTS,
      phoneOverride: "06 12 34 56 78",
    });

    expect(result).toEqual({ sent: true, fonnteMessageId: "msg-1" });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: "+33612345678" })
    );
    expect(prismaMock.orderReceiptSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientPhone: "+33612345678" }),
      })
    );
  });

  it("strips punctuation from an international number", async () => {
    await sendCustomerReceiptForOrder("order-1", {
      ...OPTS,
      phoneOverride: "+33 (0)6 12 34 56 78",
    });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: "+33612345678" })
    );
  });

  it("rejects anything that cannot be made into E.164, and sends nothing", async () => {
    for (const bad of ["not-a-phone", "+++++", "12345678901234567890"]) {
      const result = await sendCustomerReceiptForOrder("order-1", {
        ...OPTS,
        phoneOverride: bad,
      });
      expect(result).toEqual({ sent: false, skipped: true, reason: "invalid_phone" });
    }
    expect(notifyMock).not.toHaveBeenCalled();
    // A rejected number is not an attempt, so it must not reach the send log.
    expect(prismaMock.orderReceiptSend.create).not.toHaveBeenCalled();
  });

  it("leaves the order's own number untouched when no override is given", async () => {
    await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: "+33612345678" })
    );
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
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("counts every channel, not just this one", async () => {
    await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(prismaMock.orderReceiptSend.count).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
    });
  });

  it("allows the send one below the cap", async () => {
    prismaMock.orderReceiptSend.count.mockResolvedValue(MAX_RECEIPT_SENDS_PER_ORDER - 1);
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toMatchObject({ sent: true });
  });
});

describe("existing guards still hold", () => {
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

  it("logs a FAILED attempt when the gateway throws", async () => {
    notifyMock.mockRejectedValue(new Error("gateway down"));
    const result = await sendCustomerReceiptForOrder("order-1", OPTS);
    expect(result).toMatchObject({ sent: false, skipped: false, error: "gateway down" });
    expect(prismaMock.orderReceiptSend.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });
});
