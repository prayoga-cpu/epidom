import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    user: { upsert: vi.fn() },
    account: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    business: { upsert: vi.fn() },
    store: { findFirst: vi.fn(), create: vi.fn() },
    staffMember: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  return {
    tx,
    prisma,
    grantPlanWithoutPayment: vi.fn(),
    activateFree: vi.fn(),
    hashPassword: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("better-auth/crypto", () => ({ hashPassword: h.hashPassword }));
vi.mock("@/lib/services", () => ({
  subscriptionService: {
    grantPlanWithoutPayment: h.grantPlanWithoutPayment,
    activateFree: h.activateFree,
  },
}));

import { POST } from "../route";

const SECRET = "test-seed-secret";
const request = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/admin/seed-demo", { method: "POST", headers });

describe("POST /api/admin/seed-demo", () => {
  const originalSecret = process.env.SEED_DEMO_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SEED_DEMO_SECRET = SECRET;

    h.hashPassword.mockResolvedValue("hashed");
    h.prisma.$transaction.mockImplementation(async (fn: (tx: typeof h.tx) => unknown) => fn(h.tx));
    h.tx.$executeRaw.mockResolvedValue(1);
    h.tx.user.upsert.mockResolvedValue({ id: "user_demo" });
    h.tx.account.findFirst.mockResolvedValue({ id: "acc_1" });
    h.tx.business.upsert.mockResolvedValue({ id: "biz_demo" });
    h.tx.store.findFirst.mockResolvedValue({ id: "store_demo" });
    h.grantPlanWithoutPayment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SEED_DEMO_SECRET;
    else process.env.SEED_DEMO_SECRET = originalSecret;
  });

  it("returns 500 and provisions nothing when the secret is not configured", async () => {
    delete process.env.SEED_DEMO_SECRET;

    const res = await POST(request({ "x-seed-secret": "anything" }));

    expect(res.status).toBe(500);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.grantPlanWithoutPayment).not.toHaveBeenCalled();
  });

  it("returns 401 and provisions nothing without the right secret header", async () => {
    const rejected: Record<string, string>[] = [{}, { "x-seed-secret": "wrong" }];
    for (const headers of rejected) {
      const res = await POST(request(headers));
      expect(res.status).toBe(401);
    }

    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.grantPlanWithoutPayment).not.toHaveBeenCalled();
    expect(h.activateFree).not.toHaveBeenCalled();
  });

  it("provisions the demo account on OPERATIONS through the privileged grant", async () => {
    const res = await POST(request({ "x-seed-secret": SECRET }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      userId: "user_demo",
      businessId: "biz_demo",
      storeId: "store_demo",
    });
    expect(h.grantPlanWithoutPayment).toHaveBeenCalledTimes(1);
    expect(h.grantPlanWithoutPayment).toHaveBeenCalledWith("user_demo", "OPERATIONS");
    // activateFree is FREE-only now; a paid demo plan must not go through it.
    expect(h.activateFree).not.toHaveBeenCalled();
  });
});
