import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

var mockStripe: any;
vi.mock("@/lib/stripe", () => {
  mockStripe = {
    invoices: { retrieve: vi.fn(), list: vi.fn(), listLineItems: vi.fn() },
    refunds: { retrieve: vi.fn() },
  };
  return { stripe: mockStripe };
});

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    subscription: { findUnique: vi.fn() },
    signupAttribution: { findUnique: vi.fn(), updateMany: vi.fn() },
    partnerCommission: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import {
  COMMISSION_HOLD_DAYS,
  recordInvoiceCommission,
  recordRefund,
} from "../partner-commission.service";

const s = (iso: string) => Date.parse(iso) / 1000;
const asyncList = (items: unknown[]) =>
  (async function* () {
    for (const i of items) yield i;
  })();

function invoice(
  id: string,
  start: string,
  end: string,
  amount: number,
  over: Record<string, unknown> = {}
) {
  return {
    id,
    status: "paid",
    customer: "cus_1",
    currency: "eur",
    amount_paid: amount,
    total: amount,
    created: s(start),
    status_transitions: { paid_at: s(start) },
    total_discount_amounts: [],
    payments: { data: [{ payment: { type: "payment_intent", payment_intent: `pi_${id}` } }] },
    lines: {
      has_more: false,
      data: [
        {
          amount,
          discount_amounts: [],
          taxes: [],
          period: { start: s(start), end: s(end) },
          parent: { subscription_item_details: { subscription: "sub_1", proration: false } },
        },
      ],
    },
    ...over,
  };
}

const FIRST = invoice("in_1", "2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z", 1399);

const attribution = (over: Record<string, unknown> = {}) => ({
  id: "att_1",
  userId: "user_1",
  partnerId: "partner_1",
  commissionRate: new Prisma.Decimal(30),
  commissionMonths: 3,
  discountPercent: null,
  discountRedeemedAt: null,
  firstPaidAt: null,
  commissionWindowStart: null,
  commissionWindowEnd: null,
  ...over,
});

describe("recordInvoiceCommission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.subscription.findUnique.mockImplementation(({ where }: any) =>
      where.stripeCustomerId ? { userId: "user_1" } : { plan: "POS" }
    );
    mockPrisma.signupAttribution.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.partnerCommission.create.mockResolvedValue({});
    mockStripe.invoices.list.mockImplementation(() => asyncList([FIRST]));
  });

  it("opens the 3-month window on the first paid invoice and records 30% of it", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(FIRST);
    mockPrisma.signupAttribution.findUnique
      .mockResolvedValueOnce(attribution())
      .mockResolvedValueOnce(
        attribution({
          firstPaidAt: new Date("2026-10-20T08:00:00Z"),
          commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
          commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
        })
      );

    const result = await recordInvoiceCommission("in_1");

    expect(result).toEqual({ status: "recorded", amountMinor: 419 });
    expect(mockPrisma.signupAttribution.updateMany).toHaveBeenCalledWith({
      where: { id: "att_1", firstPaidAt: null },
      data: expect.objectContaining({
        firstPaidAt: new Date("2026-10-20T08:00:00Z"),
        firstPaidPlan: "POS",
        firstPaidInterval: "MONTHLY",
        firstPaidCurrency: "eur",
        commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
        commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
      }),
    });
    const row = mockPrisma.partnerCommission.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      partnerId: "partner_1",
      customerUserId: "user_1",
      kind: "INVOICE",
      sourceKey: "inv:in_1",
      stripePaymentIntentId: "pi_in_1",
      currency: "eur",
      invoiceAmount: "13.99",
      commissionableAmount: "13.99",
      amount: "4.19",
      plan: "POS",
      billingInterval: "MONTHLY",
    });
    expect(row.payableAt.getTime() - row.earnedAt.getTime()).toBe(COMMISSION_HOLD_DAYS * 86400000);
  });

  it("nothing for the 4th monthly invoice: it is past the window", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(
      invoice("in_4", "2027-01-20T08:00:00Z", "2027-02-20T08:00:00Z", 1399)
    );
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(
      attribution({
        firstPaidAt: new Date("2026-10-20T08:00:00Z"),
        commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
        commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
      })
    );

    expect(await recordInvoiceCommission("in_4")).toEqual({ status: "outside-window" });
    expect(mockPrisma.partnerCommission.create).not.toHaveBeenCalled();
  });

  it("a yearly plan earns on 3/12 of the year", async () => {
    const yearly = invoice("in_y", "2026-10-20T08:00:00Z", "2027-10-20T08:00:00Z", 13788);
    mockStripe.invoices.retrieve.mockResolvedValue(yearly);
    mockStripe.invoices.list.mockImplementation(() => asyncList([yearly]));
    mockPrisma.signupAttribution.findUnique
      .mockResolvedValueOnce(attribution())
      .mockResolvedValueOnce(
        attribution({
          firstPaidAt: new Date("2026-10-20T08:00:00Z"),
          commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
          commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
        })
      );

    await recordInvoiceCommission("in_y");

    const row = mockPrisma.partnerCommission.create.mock.calls[0][0].data;
    expect(row.commissionableAmount).toBe("34.47");
    expect(row.amount).toBe("10.34");
    expect(row.billingInterval).toBe("YEARLY");
  });

  it("the trial's $0 invoice records nothing and doesn't open the window", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(
      invoice("in_0", "2026-10-06T08:00:00Z", "2026-10-20T08:00:00Z", 0)
    );
    expect(await recordInvoiceCommission("in_0")).toEqual({ status: "not-paid" });
    expect(mockPrisma.signupAttribution.updateMany).not.toHaveBeenCalled();
  });

  it("an account with no attribution (signed up before tracking) is left alone", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(FIRST);
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(null);
    expect(await recordInvoiceCommission("in_1")).toEqual({ status: "no-attribution" });
    expect(mockStripe.invoices.list).not.toHaveBeenCalled();
  });

  it("an account with no partner still gets its first payment recorded, and no commission", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(FIRST);
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(
      attribution({ partnerId: null, commissionRate: null, commissionMonths: null })
    );
    expect(await recordInvoiceCommission("in_1")).toEqual({ status: "no-partner" });
    expect(mockPrisma.signupAttribution.updateMany.mock.calls[0][0].data).toMatchObject({
      firstPaidCurrency: "eur",
      commissionWindowStart: null,
    });
    expect(mockPrisma.partnerCommission.create).not.toHaveBeenCalled();
  });

  it("a replayed webhook is a no-op (unique source key)", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(FIRST);
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(
      attribution({
        firstPaidAt: new Date("2026-10-20T08:00:00Z"),
        commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
        commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
      })
    );
    mockPrisma.partnerCommission.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" })
    );
    expect(await recordInvoiceCommission("in_1")).toEqual({ status: "already-recorded" });
  });

  it("marks the referral discount used when the paid invoice carries it", async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(
      invoice("in_d", "2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z", 1259, {
        total_discount_amounts: [{ amount: 140, discount: "di_1" }],
      })
    );
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(
      attribution({
        discountPercent: new Prisma.Decimal(10),
        firstPaidAt: new Date("2026-10-20T08:00:00Z"),
        commissionWindowStart: new Date("2026-10-20T08:00:00Z"),
        commissionWindowEnd: new Date("2027-01-20T08:00:00Z"),
      })
    );

    await recordInvoiceCommission("in_d");

    expect(mockPrisma.signupAttribution.updateMany).toHaveBeenCalledWith({
      where: { id: "att_1", discountRedeemedAt: null },
      data: { discountRedeemedAt: new Date("2026-10-20T08:00:00Z") },
    });
    expect(mockPrisma.partnerCommission.create.mock.calls[0][0].data.amount).toBe("3.77");
  });
});

describe("recordRefund", () => {
  const original = {
    id: "com_1",
    partnerId: "partner_1",
    attributionId: "att_1",
    customerUserId: "user_1",
    stripeInvoiceId: "in_1",
    plan: "POS",
    billingInterval: "MONTHLY",
    currency: "eur",
    amount: new Prisma.Decimal("4.19"),
    invoiceAmount: new Prisma.Decimal("13.99"),
    rate: new Prisma.Decimal(30),
    status: "PENDING",
    payableAt: new Date("2026-11-19T08:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partnerCommission.findFirst.mockResolvedValue(original);
    mockPrisma.partnerCommission.findMany.mockResolvedValue([]);
    mockPrisma.partnerCommission.create.mockResolvedValue({});
  });

  it("a full refund takes the whole commission back, netted with it while it is on hold", async () => {
    mockStripe.refunds.retrieve.mockResolvedValue({
      id: "re_1",
      status: "succeeded",
      amount: 1399,
      payment_intent: "pi_in_1",
      created: s("2026-10-25T08:00:00Z"),
    });

    expect(await recordRefund("re_1")).toBe("recorded");
    expect(mockPrisma.partnerCommission.create.mock.calls[0][0].data).toMatchObject({
      kind: "REFUND_ADJUSTMENT",
      sourceKey: "refund:re_1",
      amount: "-4.19",
      reversesId: "com_1",
      payableAt: original.payableAt,
    });
  });

  it("a partial refund takes back its share; a refund after payout comes off the next one", async () => {
    mockPrisma.partnerCommission.findFirst.mockResolvedValue({ ...original, status: "PAID" });
    mockStripe.refunds.retrieve.mockResolvedValue({
      id: "re_2",
      status: "succeeded",
      amount: 700,
      payment_intent: "pi_in_1",
      created: s("2026-12-01T08:00:00Z"),
    });

    await recordRefund("re_2");

    const data = mockPrisma.partnerCommission.create.mock.calls[0][0].data;
    expect(data.amount).toBe("-2.10");
    expect(data.payableAt).toEqual(new Date("2026-12-01T08:00:00Z"));
  });

  it("never takes back more than the commission across several refunds", async () => {
    mockPrisma.partnerCommission.findMany.mockResolvedValue([
      { amount: new Prisma.Decimal("-3.00"), sourceKey: "refund:re_a" },
    ]);
    mockStripe.refunds.retrieve.mockResolvedValue({
      id: "re_b",
      status: "succeeded",
      amount: 1399,
      payment_intent: "pi_in_1",
      created: s("2026-10-26T08:00:00Z"),
    });

    await recordRefund("re_b");

    expect(mockPrisma.partnerCommission.create.mock.calls[0][0].data.amount).toBe("-1.19");
  });

  it("a failed or cancelled refund voids its adjustment", async () => {
    mockStripe.refunds.retrieve.mockResolvedValue({ id: "re_1", status: "failed" });
    mockPrisma.partnerCommission.updateMany.mockResolvedValue({ count: 1 });
    expect(await recordRefund("re_1")).toBe("voided");
    expect(mockPrisma.partnerCommission.updateMany).toHaveBeenCalledWith({
      where: { sourceKey: "refund:re_1", status: "PENDING" },
      data: { status: "VOID", note: "Refund failed" },
    });
  });

  it("a refund of a payment that earned nothing is ignored", async () => {
    mockPrisma.partnerCommission.findFirst.mockResolvedValue(null);
    mockStripe.refunds.retrieve.mockResolvedValue({
      id: "re_x",
      status: "succeeded",
      amount: 100,
      payment_intent: "pi_other",
      created: 1,
    });
    expect(await recordRefund("re_x")).toBe("no-commission");
    expect(mockPrisma.partnerCommission.create).not.toHaveBeenCalled();
  });
});
