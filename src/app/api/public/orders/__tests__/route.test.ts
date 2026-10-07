import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storefront: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
    order: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/payments", () => ({ initiatePayment: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));
vi.mock("@/lib/services", () => ({ getFinanceSettings: vi.fn() }));
vi.mock("@/lib/push/send", () => ({ sendPushToStore: vi.fn(async () => {}) }));
// after() needs a request scope; run its callback inline so the push is observable.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((fn: () => unknown) => void fn()),
}));
vi.mock("@/lib/services/order-queue-number", () => ({ allocateQueueNumber: vi.fn() }));
vi.mock("@/lib/services/pos-order-builder", () => ({
  resolveSettledOrderStatus: () => "CONFIRMED",
  deliverOrderImmediately: vi.fn(),
  draftShortfallBatchesForConfirmedOrder: vi.fn(),
}));
vi.mock("@/lib/finance/order-charges", () => ({
  computeOrderCharges: vi.fn(({ itemsTotal }: { itemsTotal: number }) => ({
    subtotal: itemsTotal,
    tax: 0,
    total: itemsTotal,
    serviceCharge: 0,
    processingFee: 0,
    taxRate: 0,
    serviceChargeRate: 0,
    processingFeeRate: 0,
  })),
}));

// The online-payment switch, per test.
const flags = vi.hoisted(() => ({ online: true }));
vi.mock("@/config/storefront-ordering.config", () => ({
  get STOREFRONT_ONLINE_PAYMENTS_ENABLED() {
    return flags.online;
  },
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { initiatePayment } from "@/lib/payments";
import { sendPushToStore } from "@/lib/push/send";
import { getFinanceSettings } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";
import { allocateQueueNumber } from "@/lib/services/order-queue-number";

const storefront = (connect: { stripeConnectAccountId: string | null; stripeConnectOnboarded: boolean }) => ({
  id: "sf_1",
  slug: "cafe",
  isPublished: true,
  acceptsOrders: true,
  storeId: "store_1",
  displayName: "Cafe",
  store: {
    id: "store_1",
    kitchenDisplayEnabled: true,
    business: {
      locale: "en",
      timezone: "Asia/Jakarta",
      user: { ...connect, subscription: { plan: "POS", status: "ACTIVE" } },
    },
  },
});

const order = (paymentMethod: string) =>
  new Request("http://localhost/api/public/orders", {
    method: "POST",
    body: JSON.stringify({
      storefrontSlug: "cafe",
      customerName: "Ana",
      orderType: "TAKEAWAY",
      paymentMethod,
      items: [{ menuItemId: "cm1a2b3c4d5e6f7g8h9i0j1k2", name: "Latte", quantity: 1, unitPrice: 4.5 }],
    }),
  });

describe("POST /api/public/orders — card payments need the merchant's Stripe account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // These cover the online-payment path, which is still wired behind the switch.
    flags.online = true;
    // Returning no menu items stops the route right after the checks under test.
    (prisma.menuItem.findMany as any).mockResolvedValue([]);
  });

  it("refuses a card order when the store has no connected Stripe account", async () => {
    (prisma.storefront.findUnique as any).mockResolvedValue(
      storefront({ stripeConnectAccountId: null, stripeConnectOnboarded: false })
    );

    const res = await POST(order("STRIPE_CARD"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/Card payment isn't available/);
    expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a card order when onboarding never finished", async () => {
    (prisma.storefront.findUnique as any).mockResolvedValue(
      storefront({ stripeConnectAccountId: "acct_123", stripeConnectOnboarded: false })
    );

    const res = await POST(order("STRIPE_CARD"));

    expect(res.status).toBe(400);
    expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
  });

  it("lets a card order through for a store with an onboarded Stripe account", async () => {
    (prisma.storefront.findUnique as any).mockResolvedValue(
      storefront({ stripeConnectAccountId: "acct_123", stripeConnectOnboarded: true })
    );

    await POST(order("STRIPE_CARD"));

    expect(prisma.menuItem.findMany).toHaveBeenCalled();
  });

  it("does not affect other payment methods", async () => {
    (prisma.storefront.findUnique as any).mockResolvedValue(
      storefront({ stripeConnectAccountId: null, stripeConnectOnboarded: false })
    );

    await POST(order("CASH"));

    expect(prisma.menuItem.findMany).toHaveBeenCalled();
  });
});

describe("POST /api/public/orders — pay at the cashier (online payment off)", () => {
  const created: { data?: Record<string, unknown> } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    flags.online = false;
    (prisma.storefront.findUnique as any).mockResolvedValue(
      storefront({ stripeConnectAccountId: null, stripeConnectOnboarded: false })
    );
    (prisma.menuItem.findMany as any).mockResolvedValue([
      { id: "cm1a2b3c4d5e6f7g8h9i0j1k2", name: "Latte", price: 4.5, productId: null, product: null },
    ]);
    (getFinanceSettings as any).mockResolvedValue({ currency: "EUR" });
    (allocateQueueNumber as any).mockResolvedValue(12);
    (prisma.$transaction as any).mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        order: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            created.data = data;
            return { id: "ord_1", ...data };
          }),
        },
      })
    );
  });

  it("places the order unpaid — never PAID before the cashier takes the money", async () => {
    const res = await POST(order("CASH"));
    expect(res.status).toBe(201);
    expect(created.data).toMatchObject({ paymentMethod: "CASH", paymentStatus: "PENDING" });
    const body = await res.json();
    expect(body.data.paymentUrl).toBeNull();
  });

  it("turns a method from a stale tab into pay at the cashier instead of refusing it", async () => {
    // A card order from a store with no Stripe account would be refused with
    // online payment on; with it off it is simply a cashier order.
    const res = await POST(order("STRIPE_CARD"));
    expect(res.status).toBe(201);
    expect(created.data).toMatchObject({ paymentMethod: "CASH", paymentStatus: "PENDING" });
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it("prices it as cash — no gateway processing fee", async () => {
    await POST(order("QRIS"));
    expect((computeOrderCharges as any).mock.calls[0][0].paymentMethod).toBe("CASH");
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it("alerts the till's devices directly, in the store's language", async () => {
    await POST(order("CASH"));
    expect(sendPushToStore).toHaveBeenCalledWith(
      "store_1",
      expect.objectContaining({
        title: "New online order · unpaid",
        body: "#12 · Ana — collect payment at the cashier",
        url: "/store/store_1/pos/orders",
        tag: "order-ord_1",
      })
    );
  });
});
