import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-level tests for the lost-update races on the POS order write paths.
 *
 * Every one of these bugs lives in the gap between a status READ outside the
 * transaction and the WRITE inside it, so they can only be reproduced by
 * driving the handler with a transaction client whose guarded `updateMany`
 * reports zero rows affected — i.e. "another till got there first".
 *
 * The assertion that matters in each case is not just the 409: it is that NO
 * bookkeeping ran. A coupon use consumed twice or a second full-total
 * OrderPayment row is money, and neither is recoverable from the ledger.
 */

// ── next/server: keep the real NextResponse, neuter after() ──────────────────
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

// Run merge's handler body directly — auth/rate-limit wrapping is not under test.
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

var prismaMock: any;
var txMock: any;

vi.mock("@/lib/prisma", () => {
  txMock = {
    order: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    orderItem: { deleteMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    orderPayment: { deleteMany: vi.fn(), create: vi.fn() },
    table: { updateMany: vi.fn() },
  };
  prismaMock = {
    order: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/auth/require-session", () => ({
  requireSessionApi: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccessWithResponse: vi.fn(async () => ({
    store: {
      id: "store-1",
      name: "Test Store",
      phone: null,
      kitchenDisplayEnabled: true,
      payLaterEnabled: true,
    },
    accessType: "owner",
  })),
}));

vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));

vi.mock("@/lib/services/stock-deduction.service", () => ({
  deductStockForOrder: vi.fn(),
  reverseStockForOrder: vi.fn(),
}));

vi.mock("@/lib/services/pos-order-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pos-order-builder")>();
  return {
    ...actual,
    validateAndBuildOrderItems: vi.fn(async () => ({
      orderItems: [
        {
          menuItemId: "menu-1",
          name: "Latte",
          quantity: 1,
          unit: "pcs",
          unitPrice: 100,
          total: 100,
          isCustom: false,
          department: null,
          initialStatus: "PENDING" as const,
        },
      ],
      subtotal: 100,
    })),
    deliverOrderImmediately: vi.fn(),
    draftShortfallBatchesForConfirmedOrder: vi.fn(),
  };
});

const NO_CHARGES = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: false,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

vi.mock("@/lib/services/finance-settings.service", () => ({
  resolveFinanceSettingsForOrder: vi.fn(async () => ({ ...NO_CHARGES })),
}));

// The merge route reaches for the barrel; only this one export is needed.
vi.mock("@/lib/services", () => ({
  resolveFinanceSettingsForOrder: vi.fn(async () => ({ ...NO_CHARGES })),
}));

vi.mock("@/lib/services/pos-discount.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pos-discount.service")>();
  return {
    ...actual,
    resolveOrderDiscount: vi.fn(async () => ({
      discountAmount: 20,
      discountReason: "Coupon: SAVE20",
      couponId: "cp-1",
      couponMaxUses: 5,
      pointsRedeemed: 10,
      warnings: [],
    })),
  };
});

vi.mock("@/lib/services/loyalty.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/loyalty.service")>();
  return {
    ...actual,
    consumeCouponUse: vi.fn(),
    redeemPointsForOrder: vi.fn(),
    earnPointsForOrder: vi.fn(async () => 0),
    reverseLoyaltyForOrder: vi.fn(),
  };
});

import { POST as FINALIZE } from "../[orderId]/finalize/route";
import { PATCH as PATCH_ORDER } from "../[orderId]/route";
import { POST as MERGE } from "../merge/route";
import { POST as HOLD } from "../hold/route";
import {
  consumeCouponUse,
  redeemPointsForOrder,
  reverseLoyaltyForOrder,
} from "@/lib/services/loyalty.service";
import { resolveOrderDiscount } from "@/lib/services/pos-discount.service";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** A body the real createPosOrderSchema accepts. */
const CHECKOUT_BODY = {
  items: [{ menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 100 }],
  paymentMethod: "CASH",
  orderType: "TAKEAWAY",
  customerId: "clh1234567890abcdefghijpp",
  couponCode: "SAVE20",
  redeemPoints: 10,
};

const HELD_ORDER = {
  id: "ord-1",
  storeId: "store-1",
  status: "HELD",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  customerName: "Walk-in",
  customerId: null,
  guestCount: null,
  shiftId: null,
  notes: null,
  discountAmount: 0,
  tableId: null,
  orderNumber: "POS-1",
  total: 100,
  payments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));
  prismaMock.customer.findFirst.mockResolvedValue({
    id: "clh1234567890abcdefghijpp",
    name: "Amélie",
    phone: null,
    email: null,
  });
  txMock.order.update.mockResolvedValue({ ...HELD_ORDER, status: "CONFIRMED", items: [] });
  txMock.order.findUnique.mockResolvedValue({ total: 100 });
  txMock.orderItem.findMany.mockResolvedValue([{ total: 100 }]);
  txMock.order.updateMany.mockResolvedValue({ count: 1 });
});

// ─── HIGH 1 — double finalize ────────────────────────────────────────────────

describe("POST /pos/orders/[orderId]/finalize — HELD claim", () => {
  const call = () =>
    FINALIZE(jsonRequest(CHECKOUT_BODY), {
      params: Promise.resolve({ id: "store-1", orderId: "ord-1" }),
    });

  it("settles the bill and does the bookkeeping when it wins the claim", async () => {
    prismaMock.order.findFirst.mockResolvedValue(HELD_ORDER);

    const res = await call();

    expect(res.status).toBe(200);
    // The claim IS the guard: HELD → settled status, scoped to the store.
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { status: "HELD", id: "ord-1", storeId: "store-1" },
      data: { status: "CONFIRMED" },
    });
    expect(consumeCouponUse).toHaveBeenCalledTimes(1);
    expect(redeemPointsForOrder).toHaveBeenCalledTimes(1);
  });

  it("409s and consumes NOTHING when another till already finalized the bill", async () => {
    // Both requests read the row as HELD outside the transaction; only one
    // wins the guarded write.
    prismaMock.order.findFirst.mockResolvedValue(HELD_ORDER);
    txMock.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    // The whole point: no second coupon use, no second points burn, and the
    // items of the already-paid order were never deleted.
    expect(consumeCouponUse).not.toHaveBeenCalled();
    expect(redeemPointsForOrder).not.toHaveBeenCalled();
    expect(txMock.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(txMock.order.update).not.toHaveBeenCalled();
  });

  it("still 409s on the cheap pre-flight check without opening a transaction", async () => {
    prismaMock.order.findFirst.mockResolvedValue({ ...HELD_ORDER, status: "CONFIRMED" });

    const res = await call();

    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ─── HIGH 2 / LOW 8 — mark-paid and cancel ───────────────────────────────────

describe("PATCH /pos/orders/[orderId] — paid and cancel claims", () => {
  const patch = (body: unknown) =>
    PATCH_ORDER(jsonRequest(body), {
      params: Promise.resolve({ id: "store-1", orderId: "ord-1" }),
    });

  beforeEach(() => {
    prismaMock.order.findFirst.mockResolvedValue({
      ...HELD_ORDER,
      status: "DELIVERED",
      paymentMethod: "PAY_LATER",
      table: null,
      payments: [],
    });
    txMock.order.update.mockResolvedValue({
      ...HELD_ORDER,
      paymentStatus: "PAID",
      status: "DELIVERED",
    });
  });

  it("writes exactly one tender row when it wins the PAID claim", async () => {
    const res = await patch({ paymentStatus: "PAID", paymentMethod: "CASH" });

    expect(res.status).toBe(200);
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { paymentStatus: { not: "PAID" }, id: "ord-1", storeId: "store-1" },
      data: { paymentStatus: "PAID" },
    });
    expect(txMock.orderPayment.create).toHaveBeenCalledTimes(1);
    expect(txMock.orderPayment.create.mock.calls[0][0].data).toMatchObject({
      orderId: "ord-1",
      method: "CASH",
    });
  });

  it("writes NO tender row when a concurrent PATCH already settled the order", async () => {
    txMock.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await patch({ paymentStatus: "PAID", paymentMethod: "CASH" });

    // The request still succeeds — the order IS paid — but it must not
    // double the money in the drawer.
    expect(res.status).toBe(200);
    expect(txMock.orderPayment.create).not.toHaveBeenCalled();
  });

  it("never invents a CASH tender when the method cannot be named", async () => {
    // PAY_LATER with no explicit method: writing CASH here would inflate the
    // drawer's expected cash for money that may have arrived by card.
    const res = await patch({ paymentStatus: "PAID" });

    expect(res.status).toBe(200);
    expect(txMock.orderPayment.create).not.toHaveBeenCalled();
  });

  it("reverses loyalty exactly once, and only for the winning cancel", async () => {
    await patch({ status: "CANCELLED" });
    expect(reverseLoyaltyForOrder).toHaveBeenCalledWith("ord-1", 1, txMock);

    vi.clearAllMocks();
    txMock.order.updateMany.mockResolvedValue({ count: 0 });
    txMock.order.update.mockResolvedValue({ ...HELD_ORDER, status: "CANCELLED" });
    prismaMock.order.findFirst.mockResolvedValue({
      ...HELD_ORDER,
      status: "DELIVERED",
      table: null,
      payments: [],
    });

    await patch({ status: "CANCELLED" });
    // Loser does nothing — reverseLoyaltyForOrder releases the coupon use, and
    // releasing it twice hands out a free extra use.
    expect(reverseLoyaltyForOrder).not.toHaveBeenCalled();
  });
});

// ─── HIGH 3 — merge ──────────────────────────────────────────────────────────

describe("POST /pos/orders/merge — HELD claims", () => {
  const TARGET = {
    id: "clh1234567890abcdefghitgt",
    storeId: "store-1",
    status: "HELD",
    paymentStatus: "PENDING",
    orderNumber: "POS-TARGET",
    discountAmount: 0,
    tableId: null,
    notes: null,
  };
  const SOURCE = { ...TARGET, id: "clh1234567890abcdefghis1z", orderNumber: "POS-SRC" };

  const call = () =>
    MERGE(jsonRequest({ targetOrderId: TARGET.id, sourceOrderIds: [SOURCE.id] }), {
      storeId: "store-1",
      params: { id: "store-1" },
    } as never);

  beforeEach(() => {
    prismaMock.order.findFirst.mockResolvedValue(TARGET);
    prismaMock.order.findMany.mockResolvedValue([SOURCE]);
    txMock.order.update.mockResolvedValue({
      id: TARGET.id,
      orderNumber: TARGET.orderNumber,
      total: 100,
    });
  });

  it("claims the target and every source before touching a single line", async () => {
    const res = await call();

    expect(res.status).toBe(200);
    const claims = txMock.order.updateMany.mock.calls.map((c: any[]) => c[0]);
    expect(claims[0]).toEqual({
      where: {
        status: "HELD",
        paymentStatus: { not: "PAID" },
        id: TARGET.id,
        storeId: "store-1",
      },
      data: { status: "HELD" },
    });
    expect(claims[1]).toEqual({
      where: {
        status: "HELD",
        paymentStatus: { not: "PAID" },
        id: { in: [SOURCE.id] },
        storeId: "store-1",
      },
      data: { status: "CANCELLED" },
    });
    expect(txMock.orderItem.updateMany).toHaveBeenCalled();
  });

  it("409s without moving any line when a source was paid meanwhile", async () => {
    txMock.order.updateMany
      .mockResolvedValueOnce({ count: 1 }) // target still held
      .mockResolvedValueOnce({ count: 0 }); // the source was finalized

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    // Nothing re-parented, nothing cancelled, nothing recomputed.
    expect(txMock.orderItem.updateMany).not.toHaveBeenCalled();
    expect(txMock.order.update).not.toHaveBeenCalled();
  });

  it("409s when the target itself is no longer a saved bill", async () => {
    txMock.order.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await call();

    expect(res.status).toBe(409);
    expect(txMock.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to merge a bill into itself", async () => {
    const res = await MERGE(
      jsonRequest({ targetOrderId: TARGET.id, sourceOrderIds: [TARGET.id] }),
      { storeId: "store-1", params: { id: "store-1" } } as never
    );
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("404s on an id belonging to another store", async () => {
    prismaMock.order.findMany.mockResolvedValue([]); // storeId-scoped query found nothing

    const res = await call();

    expect(res.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ─── Re-hold: preserve what the body doesn't mention ─────────────────────────

describe("POST /pos/orders/hold — re-holding an existing bill", () => {
  const HELD_WITH_STATE = {
    ...HELD_ORDER,
    customerId: "cus-from-hold",
    discountAmount: 30,
    discountReason: "Preset: Happy hour",
  };

  const reHold = (extra: Record<string, unknown> = {}) =>
    HOLD(
      jsonRequest({
        items: [
          { menuItemId: "clh1234567890abcdefghijkl", name: "Latte", quantity: 1, unitPrice: 100 },
        ],
        orderType: "TAKEAWAY",
        orderId: "clh1234567890abcdefghiord",
        ...extra,
      }),
      { params: Promise.resolve({ id: "store-1" }) }
    );

  beforeEach(() => {
    prismaMock.order.findFirst.mockResolvedValue(HELD_WITH_STATE);
    txMock.order.update.mockResolvedValue({ id: "ord-1", orderNumber: "POS-1", items: [] });
  });

  it("keeps the attached customer and the discount when the body mentions neither", async () => {
    const res = await reHold();

    expect(res.status).toBe(200);
    // Re-pricing from an empty body would wipe both — the client re-saves a
    // bill after editing the cart and has no reason to resend either.
    expect(resolveOrderDiscount).not.toHaveBeenCalled();
    const data = txMock.order.update.mock.calls[0][0].data;
    expect(data.customerId).toBe("cus-from-hold");
    expect(Number(data.discountAmount)).toBe(30);
    expect(data.discountReason).toBe("Preset: Happy hour");
  });

  it("detaches the customer on an explicit null", async () => {
    await reHold({ customerId: null });
    expect(txMock.order.update.mock.calls[0][0].data.customerId).toBeNull();
  });

  it("re-derives the discount as soon as the body mentions any of it", async () => {
    vi.mocked(resolveOrderDiscount).mockResolvedValue({
      discountAmount: 0,
      discountReason: undefined,
      couponId: null,
      couponMaxUses: null,
      pointsRedeemed: 0,
      warnings: [],
    });

    await reHold({ discountAmount: 0 });

    expect(resolveOrderDiscount).toHaveBeenCalled();
    const data = txMock.order.update.mock.calls[0][0].data;
    expect(Number(data.discountAmount)).toBe(0);
    // null, not undefined: undefined is a no-op on a Prisma update and left
    // the old reason next to a cleared discount.
    expect(data.discountReason).toBeNull();
  });

  it("409s without rewriting anything when the bill was finalized meanwhile", async () => {
    txMock.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await reHold();

    expect(res.status).toBe(409);
    // Rewriting a paid order back into a HELD cart would resurrect it as unpaid.
    expect(txMock.order.update).not.toHaveBeenCalled();
    expect(txMock.orderItem.deleteMany).not.toHaveBeenCalled();
  });
});
