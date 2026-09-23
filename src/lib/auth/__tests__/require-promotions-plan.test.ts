import { describe, it, expect, vi, beforeEach } from "vitest";

const storeHasPromotionsPlan = vi.fn();
vi.mock("@/lib/services/pos-discount.service", () => ({
  storeHasPromotionsPlan: (...a: unknown[]) => storeHasPromotionsPlan(...a),
}));

import { requirePromotionsPlanApi } from "../require-promotions-plan";

beforeEach(() => storeHasPromotionsPlan.mockReset());

describe("requirePromotionsPlanApi", () => {
  it("lets a store on a qualifying plan through, judged by the SAME check the order settlement uses", async () => {
    storeHasPromotionsPlan.mockResolvedValue(true);

    expect(await requirePromotionsPlanApi("s1", "Coupons")).toBeNull();
    // A storeId — the store OWNER's plan — never the session user's.
    expect(storeHasPromotionsPlan).toHaveBeenCalledWith("s1");
  });

  it("answers a store below OPERATIONS with a 403 SUBSCRIPTION_FEATURE_LOCKED and upgrade details", async () => {
    storeHasPromotionsPlan.mockResolvedValue(false);

    const res = await requirePromotionsPlanApi("s1", "Coupons");

    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SUBSCRIPTION_FEATURE_LOCKED");
    expect(body.error.message).toBe("Coupons requires the Operations plan.");
    expect(body.error.details).toEqual({
      feature: "loyaltyAndPromotions",
      requiredPlan: "OPERATIONS",
      upgradeRequired: true,
    });
  });

  it("names the feature it was asked about", async () => {
    storeHasPromotionsPlan.mockResolvedValue(false);
    const res = await requirePromotionsPlanApi("s1", "Loyalty points");
    expect((await res!.json()).error.message).toBe("Loyalty points requires the Operations plan.");
  });
});
