import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));

const storeFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { store: { findUnique: (...a: unknown[]) => storeFindUnique(...a) } },
}));

const verifyStoreAccess = vi.fn();
vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccess: (...a: unknown[]) => verifyStoreAccess(...a),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

import { requirePlan } from "../require-plan";

const STORE = "store_1";

function storeOwnedBy(ownerId: string, subscription: Record<string, unknown> | null) {
  return { business: { userId: ownerId, user: { subscription } } };
}

beforeEach(() => {
  getSession.mockReset();
  storeFindUnique.mockReset();
  verifyStoreAccess.mockReset();
  redirect.mockClear();
});

describe("requirePlan", () => {
  it("owner on a sufficient plan: passes", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    storeFindUnique.mockResolvedValue(storeOwnedBy("owner", { plan: "POS", status: "ACTIVE" }));
    await expect(requirePlan(STORE, "POS")).resolves.toEqual({ userId: "owner" });
    expect(verifyStoreAccess).not.toHaveBeenCalled();
  });

  it("owner below the required tier: sent to the upgrade page (unchanged)", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    storeFindUnique.mockResolvedValue(storeOwnedBy("owner", { plan: "FREE", status: "ACTIVE" }));
    await expect(requirePlan(STORE, "POS")).rejects.toThrow(/REDIRECT:.*pricing|REDIRECT:.*upgrade/i);
  });

  it("owner with a pending custom price: sent to Billing (unchanged)", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    storeFindUnique.mockResolvedValue(
      storeOwnedBy("owner", { plan: "POS", status: "ACTIVE", customPricePendingAt: new Date() })
    );
    await expect(requirePlan(STORE, "POS")).rejects.toThrow("REDIRECT:/store/store_1/billing?customPrice=pending");
  });

  it("a linked staff account is admitted on the OWNER's plan — it has no subscription of its own", async () => {
    getSession.mockResolvedValue({ user: { id: "staff_user" } });
    storeFindUnique.mockResolvedValue(storeOwnedBy("owner", { plan: "POS", status: "ACTIVE" }));
    verifyStoreAccess.mockResolvedValue({ accessType: "staff", staffMemberId: "s1" });

    await expect(requirePlan(STORE, "POS")).resolves.toEqual({ userId: "staff_user" });
    expect(verifyStoreAccess).toHaveBeenCalledWith(STORE, "staff_user");
  });

  it("a stranger is sent to the store list", async () => {
    getSession.mockResolvedValue({ user: { id: "stranger" } });
    storeFindUnique.mockResolvedValue(storeOwnedBy("owner", { plan: "POS", status: "ACTIVE" }));
    verifyStoreAccess.mockRejectedValue(new Error("Business not found"));

    await expect(requirePlan(STORE, "POS")).rejects.toThrow("REDIRECT:/stores");
  });

  it("a staff account on an owner plan that's too low goes to the store list, not a pricing page it can't use", async () => {
    getSession.mockResolvedValue({ user: { id: "staff_user" } });
    storeFindUnique.mockResolvedValue(storeOwnedBy("owner", { plan: "FREE", status: "ACTIVE" }));
    verifyStoreAccess.mockResolvedValue({ accessType: "staff", staffMemberId: "s1" });

    await expect(requirePlan(STORE, "POS")).rejects.toThrow("REDIRECT:/stores");
  });

  it("a staff account when the owner's plan is suspended goes to the store list — NOT the owner-only Billing page (no redirect loop)", async () => {
    getSession.mockResolvedValue({ user: { id: "staff_user" } });
    storeFindUnique.mockResolvedValue(
      storeOwnedBy("owner", { plan: "POS", status: "ACTIVE", customPricePendingAt: new Date() })
    );
    verifyStoreAccess.mockResolvedValue({ accessType: "staff", staffMemberId: "s1" });

    await expect(requirePlan(STORE, "POS")).rejects.toThrow("REDIRECT:/stores");
  });

  it("no session: to login", async () => {
    getSession.mockResolvedValue(null);
    await expect(requirePlan(STORE, "POS")).rejects.toThrow("REDIRECT:/login");
  });
});
