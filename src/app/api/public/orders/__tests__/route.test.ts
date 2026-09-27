import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storefront: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/payments", () => ({ initiatePayment: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));
vi.mock("@/lib/services", () => ({ getFinanceSettings: vi.fn() }));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";

const storefront = (connect: { stripeConnectAccountId: string | null; stripeConnectOnboarded: boolean }) => ({
  id: "sf_1",
  slug: "cafe",
  isPublished: true,
  acceptsOrders: true,
  store: {
    id: "store_1",
    business: {
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
