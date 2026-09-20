/**
 * The automatic receipt email — fired by order/placed and
 * order/payment.confirmed for an order that carries a customer email.
 *
 * What matters here is what it must NOT do: send before the order is paid, send
 * twice (both events fire, and the cashier may have sent it by hand first), or
 * log a receipt as delivered when no mail provider is configured. Every skip is
 * silent — no send-log row — so the status the cashier reads only ever reports
 * real attempts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var sendMailMock: any;
var buildReceiptMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    orderReceiptSend: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    order: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/services/email.service", () => {
  sendMailMock = vi.fn().mockResolvedValue({ success: true, messageId: "re_123" });
  return { sendReceiptEmail: sendMailMock };
});

vi.mock("@/lib/receipts/build-receipt-data", () => {
  buildReceiptMock = vi.fn();
  return { buildReceiptData: buildReceiptMock };
});

import { sendAutoReceiptEmailForOrder } from "../send-receipt-email";

function built(overrides: Record<string, unknown> = {}) {
  return {
    receipt: {
      storeName: "Warung Kopi",
      orderNumber: "POS-1",
      total: 12.5,
      currency: "EUR",
      locale: "fr",
    },
    orderId: "order-1",
    storeId: "store-1",
    storefrontSlug: null,
    customerPhone: null,
    customerEmail: "claire@example.com",
    customerName: "Claire",
    paymentStatus: "PAID",
    autoSendWhatsappReceipt: false,
    orderDate: new Date("2026-09-19T10:00:00.000Z"),
    ...overrides,
  };
}

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  prismaMock.orderReceiptSend.count.mockResolvedValue(0);
  prismaMock.orderReceiptSend.findFirst.mockResolvedValue(null);
  prismaMock.orderReceiptSend.create.mockResolvedValue({});
  sendMailMock.mockResolvedValue({ success: true, messageId: "re_123" });
  buildReceiptMock.mockResolvedValue(built());
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

describe("sendAutoReceiptEmailForOrder", () => {
  it("emails the address on the order and logs one SENT row for it", async () => {
    const result = await sendAutoReceiptEmailForOrder("order-1");

    expect(result).toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({
      to: "claire@example.com",
      orderNumber: "POS-1",
      receiptUrl: expect.stringContaining("/r/order-1"),
    });
    expect(prismaMock.orderReceiptSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        channel: "EMAIL",
        recipientEmail: "claire@example.com",
        status: "SENT",
      }),
    });
  });

  it("builds the receipt once, not once for the gate and again for the send", async () => {
    await sendAutoReceiptEmailForOrder("order-1");
    expect(buildReceiptMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an order with no customer email", async () => {
    buildReceiptMock.mockResolvedValue(built({ customerEmail: null }));
    const result = await sendAutoReceiptEmailForOrder("order-1");
    expect(result).toEqual({ sent: false, skipped: true, reason: "no_customer_email" });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(prismaMock.orderReceiptSend.create).not.toHaveBeenCalled();
  });

  it("waits for payment: a Pay Later / still-PENDING order is skipped until it is paid", async () => {
    buildReceiptMock.mockResolvedValue(built({ paymentStatus: "PENDING" }));
    const result = await sendAutoReceiptEmailForOrder("order-1");
    expect(result).toEqual({ sent: false, skipped: true, reason: "not_paid" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("never sends twice: an EMAIL row already SENT (the other event, or a manual send) wins", async () => {
    prismaMock.orderReceiptSend.findFirst.mockResolvedValue({ id: "send-1" });
    const result = await sendAutoReceiptEmailForOrder("order-1");
    expect(result).toEqual({ sent: false, skipped: true, reason: "already_sent" });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(prismaMock.orderReceiptSend.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "order-1", channel: "EMAIL", status: "SENT" },
      })
    );
  });

  it("does not log a delivered receipt when Resend is not configured", async () => {
    // sendReceiptEmail reports a simulated success without a key; logging that
    // as SENT would put a receipt nobody got on the cashier's status line.
    delete process.env.RESEND_API_KEY;
    const result = await sendAutoReceiptEmailForOrder("order-1");
    expect(result).toEqual({ sent: false, skipped: true, reason: "email_not_configured" });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(prismaMock.orderReceiptSend.create).not.toHaveBeenCalled();
  });

  it("records a provider failure as FAILED and returns it without throwing", async () => {
    // Throwing would have Inngest replay it, burning the per-order send
    // allowance on repeat failures; the FAILED row is what the cashier retries from.
    sendMailMock.mockResolvedValue({ success: false, error: "Recipient rejected" });
    const result = await sendAutoReceiptEmailForOrder("order-1");

    expect(result).toEqual({ sent: false, skipped: false, error: "Recipient rejected" });
    expect(prismaMock.orderReceiptSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: "EMAIL",
        status: "FAILED",
        errorMessage: "Recipient rejected",
      }),
    });
  });

  it("honours the per-order send cap shared with WhatsApp", async () => {
    prismaMock.orderReceiptSend.count.mockResolvedValue(10);
    const result = await sendAutoReceiptEmailForOrder("order-1");
    expect(result).toMatchObject({ sent: false, skipped: true, reason: "send_limit_reached" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("skips an order that does not exist", async () => {
    buildReceiptMock.mockResolvedValue(null);
    const result = await sendAutoReceiptEmailForOrder("nope");
    expect(result).toEqual({ sent: false, skipped: true, reason: "order_not_found" });
  });
});
