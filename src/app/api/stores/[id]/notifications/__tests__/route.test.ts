import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const prismaMock = vi.hoisted(() => ({
  order: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  storefront: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "../route";

const STORE = "store_abc12345";
const ctx = () => ({ params: Promise.resolve({ id: STORE }) });
const get = (query = "") =>
  GET(new Request(`http://localhost/api/stores/${STORE}/notifications${query}`), ctx());

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.reservation.findMany.mockResolvedValue([]);
  prismaMock.storefront.findUnique.mockResolvedValue({
    isPublished: false,
    displayName: "Cafe",
    menuCategories: [],
  });
});

describe("GET /notifications", () => {
  it("lists an unpaid storefront order whatever its status (kitchen display off = DELIVERED)", async () => {
    await get();
    const where = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { status: "CONFIRMED" },
      { source: "STOREFRONT", paymentStatus: "PENDING", status: { not: "CANCELLED" } },
    ]);
    // The Back Office bell still sees every source.
    expect(where.source).toBeUndefined();
  });

  it("flags an unpaid storefront order and carries what the bell needs to word it", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        orderNumber: "STO-0042",
        status: "DELIVERED",
        createdAt: new Date("2026-10-06T02:00:00Z"),
        source: "STOREFRONT",
        paymentStatus: "PENDING",
      },
    ]);
    const json = await (await get("?scope=pos")).json();
    expect(json.data.notifications[0]).toMatchObject({
      id: "order-o1",
      type: "order",
      unpaid: true,
      orderNumber: "STO-0042",
      source: "STOREFRONT",
      href: `/store/${STORE}/pos/orders`,
    });
  });

  it("POS scope: never the till's own sales, and no Back Office setup reminders", async () => {
    const json = await (await get("?scope=pos")).json();
    const where = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(where.source).toEqual({ not: "POS" });
    // A delivery-app order keyed in at the till keeps the till's POS- number.
    expect(where.NOT).toEqual({ orderNumber: { startsWith: "POS-" } });
    expect(prismaMock.storefront.findUnique).not.toHaveBeenCalled();
    expect(json.data.notifications.some((n: { type: string }) => n.type === "onboarding")).toBe(
      false
    );
  });

  it("Back Office scope keeps the setup reminders", async () => {
    const json = await (await get()).json();
    expect(
      json.data.notifications.filter((n: { type: string }) => n.type === "onboarding")
    ).toHaveLength(2);
  });

  it("rejects an unknown scope instead of silently treating it as the Back Office", async () => {
    const res = await get("?scope=kitchen");
    expect(res.status).toBe(400);
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });
});
