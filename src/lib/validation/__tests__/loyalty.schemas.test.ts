import { describe, it, expect } from "vitest";
import { loyaltyEnableError, updateLoyaltySettingsSchema } from "../loyalty.schemas";

describe("updateLoyaltySettingsSchema", () => {
  it("accepts any subset, including just the switch", () => {
    expect(updateLoyaltySettingsSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(
      updateLoyaltySettingsSchema.parse({
        spendPerPoint: 10000,
        pointValue: 100,
        minRedeemPoints: 20,
      })
    ).toEqual({ spendPerPoint: 10000, pointValue: 100, minRedeemPoints: 20 });
  });

  it("refuses an empty body", () => {
    expect(updateLoyaltySettingsSchema.safeParse({}).success).toBe(false);
  });

  it("keeps amounts non-negative and within the column precision", () => {
    expect(updateLoyaltySettingsSchema.safeParse({ spendPerPoint: -1 }).success).toBe(false);
    expect(updateLoyaltySettingsSchema.safeParse({ spendPerPoint: 1.005 }).success).toBe(false);
    // Decimal(12,4) allows 4 decimals on the point value (a EUR store's 0.05).
    expect(updateLoyaltySettingsSchema.safeParse({ pointValue: 0.0125 }).success).toBe(true);
    expect(updateLoyaltySettingsSchema.safeParse({ pointValue: 0.00001 }).success).toBe(false);
    expect(updateLoyaltySettingsSchema.safeParse({ minRedeemPoints: 1.5 }).success).toBe(false);
    expect(updateLoyaltySettingsSchema.safeParse({ minRedeemPoints: -1 }).success).toBe(false);
  });
});

describe("loyaltyEnableError", () => {
  it("needs BOTH amounts positive, and names the offending field", () => {
    expect(loyaltyEnableError({ spendPerPoint: 1, pointValue: 0.05 })).toBeNull();
    expect(loyaltyEnableError({ spendPerPoint: 0, pointValue: 0.05 })?.field).toBe("spendPerPoint");
    expect(loyaltyEnableError({ spendPerPoint: 1, pointValue: 0 })?.field).toBe("pointValue");
    expect(loyaltyEnableError({ spendPerPoint: 0, pointValue: 0 })?.field).toBe("spendPerPoint");
  });
});
