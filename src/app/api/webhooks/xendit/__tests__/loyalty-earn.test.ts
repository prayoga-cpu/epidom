import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Xendit delivers the same `paid` callback more than once by design (it
 * retries until it gets a 2xx). The loyalty earn therefore has to sit OUTSIDE
 * the "first time we saw PAID" guard: an earn that failed transiently on the
 * first delivery would otherwise never be retried, because every retry sees
 * paymentStatus === "PAID" and skips the whole block.
 *
 * earnPointsForOrder is idempotent on its own (it claims Order.pointsEarned),
 * so running it on every delivery credits exactly once and completes a
 * previously-swallowed failure.
 */

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findFirst: vi.fn(), update: vi.fn() },
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/payments/providers/xendit", () => ({
  parseXenditWebhook: vi.fn(() => ({
    orderId: "ord-1",
    paid: true,
    failed: false,
    expired: false,
  })),
}));

vi.mock("@/lib/services/stock-deduction.service", () => ({
  deductStockForOrder: vi.fn(),
}));

const earnPointsForOrder = vi.fn(async () => 0);
vi.mock("@/lib/services/loyalty.service", () => ({
  earnPointsForOrder: (...a: unknown[]) => earnPointsForOrder(...(a as [])),
}));

const send = vi.fn();
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: (...a: unknown[]) => send(...a) } }));

import { POST } from "../route";

const call = () =>
  POST(
    new Request("http://localhost/api/webhooks/xendit", {
      method: "POST",
      body: JSON.stringify({ data: { id: "xen-1" } }),
      headers: { "content-type": "application/json" },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.update.mockResolvedValue({});
});

describe("POST /api/webhooks/xendit — loyalty earn", () => {
  it("credits points on the first PAID delivery", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "ord-1",
      storeId: "store-1",
      paymentStatus: "PENDING",
      status: "CONFIRMED",
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(prismaMock.order.update).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(earnPointsForOrder).toHaveBeenCalledWith("ord-1");
  });

  it("STILL attempts the earn on a retry that finds the order already PAID", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "ord-1",
      storeId: "store-1",
      paymentStatus: "PAID",
      status: "CONFIRMED",
    });

    const res = await call();

    expect(res.status).toBe(200);
    // The once-only guard still holds for the status flip and the event…
    expect(prismaMock.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // …but the idempotent earn runs, so a swallowed failure is recoverable.
    expect(earnPointsForOrder).toHaveBeenCalledWith("ord-1");
  });

  it("never fails the webhook when the earn throws", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "ord-1",
      storeId: "store-1",
      paymentStatus: "PENDING",
      status: "CONFIRMED",
    });
    earnPointsForOrder.mockRejectedValueOnce(new Error("db down"));

    // A 500 here makes Xendit replay the whole payload, stock deduction
    // included; an uncredited point is recoverable on the next retry.
    const res = await call();
    expect(res.status).toBe(200);
  });
});
