import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the handler body directly — auth/rate-limit wrapping is not what's under test.
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const findByUserId = vi.fn();
vi.mock("@/lib/repositories", () => ({
  subscriptionRepository: { findByUserId: (...a: unknown[]) => findByUserId(...a) },
  storeRepository: { count: vi.fn().mockResolvedValue(1) },
  userRepository: { getProfile: vi.fn().mockResolvedValue({ business: { id: "biz_1" } }) },
}));

const activateFree = vi.fn();
vi.mock("@/lib/services", () => ({
  subscriptionService: { activateFree: (...a: unknown[]) => activateFree(...a) },
}));

const businessFindUnique = vi.fn();
const staffFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: { findUnique: (...a: unknown[]) => businessFindUnique(...a) },
    staffMember: { findFirst: (...a: unknown[]) => staffFindFirst(...a) },
  },
}));

const verifyStoreAccess = vi.fn();
vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccess: (...a: unknown[]) => verifyStoreAccess(...a),
}));

import { GET } from "../route";

const ownerSub = {
  id: "sub_owner",
  plan: "POS",
  status: "ACTIVE",
  currentPeriodStart: new Date("2026-01-01"),
  currentPeriodEnd: new Date("2026-02-01"),
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: "cus_real",
  stripeSubscriptionId: "sub_stripe",
  customPriceAmount: 99,
  customPriceCurrency: "USD",
  customPriceInterval: "MONTHLY",
  customPricePlan: "OPERATIONS",
  customPricePendingAt: null,
};

const call = (userId: string, query = "") =>
  GET(new Request(`http://localhost/api/subscriptions/status${query}`), { userId } as never);

beforeEach(() => {
  findByUserId.mockReset();
  activateFree.mockReset();
  businessFindUnique.mockReset();
  staffFindFirst.mockReset();
  verifyStoreAccess.mockReset();
});

describe("GET /api/subscriptions/status", () => {
  it("a linked staff account, asking from inside a store, gets the OWNER's plan — and never a provisioned FREE of its own", async () => {
    verifyStoreAccess.mockResolvedValue({
      accessType: "staff",
      staffMemberId: "s1",
      store: { id: "store_1", businessId: "biz_1" },
    });
    businessFindUnique.mockResolvedValue({ userId: "owner_user" });
    findByUserId.mockResolvedValue(ownerSub);

    const res = await call("staff_user", "?storeId=store_1");
    const body = await res.json();

    expect(findByUserId).toHaveBeenCalledWith("owner_user");
    expect(findByUserId).not.toHaveBeenCalledWith("staff_user");
    expect(activateFree).not.toHaveBeenCalled();
    expect(body.data.subscription.plan).toBe("POS");
  });

  it("strips billing detail for a staff account: no payment management, no cancel, no quoted custom price", async () => {
    verifyStoreAccess.mockResolvedValue({
      accessType: "staff",
      staffMemberId: "s1",
      store: { id: "store_1", businessId: "biz_1" },
    });
    businessFindUnique.mockResolvedValue({ userId: "owner_user" });
    findByUserId.mockResolvedValue(ownerSub);

    const { data } = await (await call("staff_user", "?storeId=store_1")).json();

    expect(data.subscription.canManagePayment).toBe(false);
    expect(data.subscription.canCancel).toBe(false);
    expect(data.subscription.customPriceAmount).toBeNull();
    expect(data.subscription.customPricePlan).toBeNull();
    expect(data.storeUsage).toBeNull();
  });

  it("the owner asking from inside their own store takes the normal path, on their OWN subscription", async () => {
    verifyStoreAccess.mockResolvedValue({
      accessType: "owner",
      store: { id: "store_1", businessId: "biz_1" },
    });
    findByUserId.mockResolvedValue(ownerSub);

    const { data } = await (await call("owner_user", "?storeId=store_1")).json();

    expect(findByUserId).toHaveBeenCalledWith("owner_user");
    expect(data.subscription.canManagePayment).toBe(true);
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("no storeId at all: unchanged, user-scoped behaviour", async () => {
    findByUserId.mockResolvedValue(ownerSub);

    await call("owner_user");

    expect(verifyStoreAccess).not.toHaveBeenCalled();
    expect(findByUserId).toHaveBeenCalledWith("owner_user");
  });

  it("a storeId the caller has no access to falls through to their own (never someone else's) subscription", async () => {
    verifyStoreAccess.mockRejectedValue(new Error("Business not found"));
    findByUserId.mockResolvedValue(ownerSub);

    await call("stranger", "?storeId=store_1");

    expect(businessFindUnique).not.toHaveBeenCalled();
    expect(findByUserId).toHaveBeenCalledWith("stranger");
  });

  describe("no subscription yet (auto-provisioning path)", () => {
    it("a staff-only login (linked, no business) opening the store list is NOT handed a FREE subscription", async () => {
      findByUserId.mockResolvedValue(null);
      businessFindUnique.mockResolvedValue(null);
      staffFindFirst.mockResolvedValue({ id: "staff_1" });

      const { data } = await (await call("staff_user")).json();

      expect(activateFree).not.toHaveBeenCalled();
      expect(data).toEqual({ hasSubscription: false, subscription: null, storeUsage: null });
      expect(staffFindFirst.mock.calls[0][0].where).toMatchObject({
        userId: "staff_user",
        isActive: true,
        role: { not: "OWNER" },
      });
    });

    it("a brand-new account with neither a business nor a staff link is still provisioned as before", async () => {
      findByUserId.mockResolvedValueOnce(null).mockResolvedValueOnce(ownerSub);
      businessFindUnique.mockResolvedValue(null);
      staffFindFirst.mockResolvedValue(null);

      await call("new_user");

      expect(activateFree).toHaveBeenCalledWith("new_user", "FREE");
    });

    it("an owner who is ALSO linked as staff elsewhere is still provisioned (owning a business wins)", async () => {
      findByUserId.mockResolvedValueOnce(null).mockResolvedValueOnce(ownerSub);
      businessFindUnique.mockResolvedValue({ id: "biz_1" });
      staffFindFirst.mockResolvedValue({ id: "staff_1" });

      await call("dual_user");

      expect(activateFree).toHaveBeenCalledWith("dual_user", "FREE");
      expect(staffFindFirst).not.toHaveBeenCalled();
    });
  });
});
