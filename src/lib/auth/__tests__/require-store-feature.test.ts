import { describe, it, expect, vi, beforeEach } from "vitest";

const getStorePlan = vi.fn();
vi.mock("@/lib/plans/store-plan", () => ({
  getStorePlan: (...a: unknown[]) => getStorePlan(...a),
}));

import { requireStoreFeatureApi } from "../require-store-feature";

beforeEach(() => getStorePlan.mockReset());

describe("requireStoreFeatureApi", () => {
  it("lets a store whose owner's plan includes the feature through", async () => {
    getStorePlan.mockResolvedValue("OPERATIONS");

    expect(await requireStoreFeatureApi("s1", "finance", "Finance reports")).toBeNull();
    // The STORE's plan (its owner's), never the session user's.
    expect(getStorePlan).toHaveBeenCalledWith("s1");
  });

  it("lets a higher plan through too", async () => {
    getStorePlan.mockResolvedValue("ENTERPRISE");
    expect(await requireStoreFeatureApi("s1", "finance")).toBeNull();
  });

  it("answers a lower plan with 403 SUBSCRIPTION_FEATURE_LOCKED and the plan that unlocks it", async () => {
    getStorePlan.mockResolvedValue("POS");

    const res = await requireStoreFeatureApi("s1", "finance", "Finance reports");

    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SUBSCRIPTION_FEATURE_LOCKED");
    expect(body.error.message).toBe("Finance reports requires the Operations plan.");
    expect(body.error.details).toEqual({
      feature: "finance",
      requiredPlan: "OPERATIONS",
      upgradeRequired: true,
    });
  });

  it("follows FEATURE_MIN_PLAN for whichever feature it is asked about", async () => {
    getStorePlan.mockResolvedValue("FREE");

    const res = await requireStoreFeatureApi("s1", "customDevelopment");

    expect((await res!.json()).error.details.requiredPlan).toBe("POS");
  });
});
