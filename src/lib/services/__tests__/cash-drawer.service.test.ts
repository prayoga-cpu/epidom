/**
 * Cash-drawer fetching.
 *
 * The arithmetic is tested in lib/finance/__tests__/cash-drawer.test.ts; what
 * is tested here is the half that can silently go wrong at the database
 * boundary. Every one of these queries used to filter `paymentMethod: "CASH"`,
 * which excludes a bill settled cash + card (its `paymentMethod` is the
 * literal "SPLIT") — so the cash that genuinely went into the drawer never
 * reached the arithmetic at all, and the till came up short by exactly that
 * amount with nothing on any screen to explain it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findMany: vi.fn().mockResolvedValue([]) },
    cashMovement: { findMany: vi.fn().mockResolvedValue([]) },
    shift: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma: prismaMock };
});

import { getShiftCashOnHand, getWindowCashOnHand } from "../cash-drawer.service";

const SHIFT = {
  id: "shift-1",
  openedAt: new Date("2026-09-19T03:00:00.000Z"),
  closedAt: new Date("2026-09-19T15:00:00.000Z"),
  openingCash: 100,
  closingCash: null,
};

/** The OR every cash query must carry: legacy/single-tender CASH, or a CASH tender. */
const COLLECTS_CASH = {
  OR: [{ paymentMethod: "CASH" }, { payments: { some: { method: "CASH" } } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.cashMovement.findMany.mockResolvedValue([]);
  prismaMock.shift.findMany.mockResolvedValue([]);
});

describe("getShiftCashOnHand", () => {
  it("selects orders with a CASH tender, not only paymentMethod CASH", async () => {
    await getShiftCashOnHand("store-1", SHIFT);

    const [salesCall, refundCall] = prismaMock.order.findMany.mock.calls;
    expect(salesCall[0].where).toMatchObject({
      storeId: "store-1",
      shiftId: "shift-1",
      ...COLLECTS_CASH,
    });
    // Refunds are still attributed by refundedAt — the day the money left the
    // drawer — not by the sale's own date.
    expect(refundCall[0].where).toMatchObject({
      storeId: "store-1",
      refundAmount: { gt: 0 },
      ...COLLECTS_CASH,
    });
    expect(refundCall[0].where.refundedAt).toEqual({
      gte: SHIFT.openedAt,
      lte: SHIFT.closedAt,
    });
  });

  it("selects the tender rows UNFILTERED, so an empty array means 'legacy order'", async () => {
    await getShiftCashOnHand("store-1", SHIFT);

    for (const call of prismaMock.order.findMany.mock.calls) {
      expect(call[0].select.payments).toEqual({
        select: { method: true, amount: true, refundedAmount: true },
      });
      // Filtering the relation down to CASH rows would make a card-only split
      // bill indistinguishable from a legacy cash one.
      expect(call[0].select.payments.where).toBeUndefined();
    }
  });

  it("counts only the CASH tenders of a split bill", async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([
        {
          paymentMethod: "SPLIT",
          paymentStatus: "PAID",
          status: "DELIVERED",
          total: 100,
          refundAmount: 0,
          payments: [
            { method: "CASH", amount: 40, refundedAmount: 0 },
            { method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    const breakdown = await getShiftCashOnHand("store-1", SHIFT);
    expect(breakdown.cashSales).toBe(40);
    expect(breakdown.expectedCash).toBe(140);
  });

  it("keeps a legacy order with no tender rows on its whole total", async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([
        {
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          status: "DELIVERED",
          total: 75,
          refundAmount: 0,
          payments: [],
        },
      ])
      .mockResolvedValueOnce([]);

    const breakdown = await getShiftCashOnHand("store-1", SHIFT);
    expect(breakdown.cashSales).toBe(75);
  });

  it("subtracts only the cash part of a refund on a split bill", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        paymentMethod: "SPLIT",
        paymentStatus: "PAID",
        status: "DELIVERED",
        total: 100,
        // Order-level refund is 60, but it all came off the card.
        refundAmount: 60,
        payments: [
          { method: "CASH", amount: 40, refundedAmount: 0 },
          { method: "STRIPE_CARD", amount: 60, refundedAmount: 60 },
        ],
      },
    ]);

    const breakdown = await getShiftCashOnHand("store-1", SHIFT);
    expect(breakdown.cashRefunds).toBe(0);
  });
});

describe("getWindowCashOnHand", () => {
  it("applies the CASH-tender filter to linked, unlinked and refunded queries alike", async () => {
    const from = new Date("2026-09-19T00:00:00.000Z");
    const to = new Date("2026-09-19T23:59:59.000Z");

    await getWindowCashOnHand("store-1", from, to);

    const calls = prismaMock.order.findMany.mock.calls.map((c: any[]) => c[0].where);
    expect(calls).toHaveLength(3);
    for (const where of calls) {
      expect(where).toMatchObject({ storeId: "store-1", ...COLLECTS_CASH });
    }
    // Linked vs unlinked stays the till-attribution split it always was.
    expect(calls[0].shiftId).toEqual({ not: null });
    expect(calls[1].shiftId).toBeNull();
    expect(calls[2].refundedAt).toEqual({ gte: from, lte: to });
  });
});
