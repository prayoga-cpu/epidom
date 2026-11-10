import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findSubscription: vi.fn(),
  findMarker: vi.fn(),
  createMarker: vi.fn(),
  findUser: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verification: { findFirst: h.findMarker, create: h.createMarker },
    user: { findUnique: h.findUser },
  },
}));
vi.mock("@/lib/repositories", () => ({
  subscriptionRepository: { findByStripeSubscriptionId: h.findSubscription },
}));
vi.mock("../email.service", () => ({ sendSubscriptionReceiptEmail: h.send }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { formatInvoiceAmount, sendSubscriptionReceipt } from "../subscription-receipt.service";

const invoice = (over: Record<string, unknown> = {}) =>
  ({
    id: "in_1",
    amount_paid: 13799,
    currency: "eur",
    number: "EPD-0001",
    hosted_invoice_url: "https://invoice.stripe.com/i/in_1",
    invoice_pdf: "https://pay.stripe.com/invoice/in_1/pdf",
    status_transitions: { paid_at: 1790000000 },
    subscription: "sub_1",
    lines: { data: [{ period: { start: 1790000000, end: 1792592000 } }] },
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.findSubscription.mockResolvedValue({ userId: "u1", plan: "POS" });
  h.findMarker.mockResolvedValue(null);
  h.findUser.mockResolvedValue({ email: "owner@example.com", name: "Sam", locale: "fr" });
  h.send.mockResolvedValue({ success: true, messageId: "m1" });
});

describe("formatInvoiceAmount", () => {
  it("reads Stripe's hundredths, and IDR the same way, with no decimals shown", () => {
    expect(formatInvoiceAmount(13799, "eur", "fr")).toContain("137,99");
    expect(formatInvoiceAmount(22900000, "idr", "id").replace(/\s/g, " ")).toContain("229.000");
    expect(formatInvoiceAmount(1000, "jpy", "en")).toContain("1,000");
  });
});

describe("sendSubscriptionReceipt", () => {
  it("emails the owner the plan, the amount, the period and the invoice links", async () => {
    await sendSubscriptionReceipt(invoice());
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        name: "Sam",
        locale: "fr",
        planName: "POS",
        invoiceNumber: "EPD-0001",
        invoiceUrl: "https://invoice.stripe.com/i/in_1",
        pdfUrl: "https://pay.stripe.com/invoice/in_1/pdf",
        paidAt: new Date(1790000000 * 1000),
        period: { start: new Date(1790000000 * 1000), end: new Date(1792592000 * 1000) },
      })
    );
    expect(h.send.mock.calls[0][0].amountLabel).toContain("137,99");
  });

  it("records that the invoice was sent, so a retried event doesn't send it twice", async () => {
    await sendSubscriptionReceipt(invoice());
    expect(h.createMarker).toHaveBeenCalledWith({
      data: expect.objectContaining({ identifier: "subscription-receipt:in_1" }),
    });
    h.send.mockClear();
    h.findMarker.mockResolvedValue({ id: "v1" });
    await sendSubscriptionReceipt(invoice());
    expect(h.send).not.toHaveBeenCalled();
  });

  it("sends nothing for a free invoice (the trial's), an unknown subscription or no email", async () => {
    await sendSubscriptionReceipt(invoice({ amount_paid: 0 }));
    h.findSubscription.mockResolvedValueOnce(null);
    await sendSubscriptionReceipt(invoice());
    h.findUser.mockResolvedValueOnce({ email: "", name: null, locale: "en" });
    await sendSubscriptionReceipt(invoice());
    expect(h.send).not.toHaveBeenCalled();
  });

  it("a failed send is not recorded as sent and never throws", async () => {
    h.send.mockResolvedValueOnce({ success: false, error: "resend down" });
    await expect(sendSubscriptionReceipt(invoice())).resolves.toBeUndefined();
    expect(h.createMarker).not.toHaveBeenCalled();
    h.findUser.mockRejectedValueOnce(new Error("db"));
    await expect(sendSubscriptionReceipt(invoice())).resolves.toBeUndefined();
  });
});
