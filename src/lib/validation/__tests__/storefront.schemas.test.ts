import { describe, it, expect } from "vitest";
import { updateGoogleReviewSchema, recordStorefrontEventSchema } from "../storefront.schemas";

describe("updateGoogleReviewSchema", () => {
  it("accepts a link on its own", () => {
    expect(updateGoogleReviewSchema.safeParse({ link: "ChIJN1t_tDeuEmsRUsoyG83frY4" }).success).toBe(
      true
    );
  });

  it("accepts the switch on its own", () => {
    expect(updateGoogleReviewSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it("accepts an empty-string link — that is how a store disconnects", () => {
    expect(updateGoogleReviewSchema.safeParse({ link: "" }).success).toBe(true);
  });

  it("rejects a body that changes nothing", () => {
    expect(updateGoogleReviewSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an absurdly long link", () => {
    expect(updateGoogleReviewSchema.safeParse({ link: "x".repeat(2049) }).success).toBe(false);
  });

  it("rejects a non-boolean switch", () => {
    expect(updateGoogleReviewSchema.safeParse({ enabled: "yes" }).success).toBe(false);
  });

  it("drops fields it doesn't own, so a stray isPublished can't ride along", () => {
    const parsed = updateGoogleReviewSchema.parse({
      link: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      isPublished: false,
      acceptsOrders: false,
    });
    expect(parsed).toEqual({ link: "ChIJN1t_tDeuEmsRUsoyG83frY4" });
  });
});

describe("recordStorefrontEventSchema", () => {
  it("accepts a REVIEW_CLICK event", () => {
    expect(recordStorefrontEventSchema.safeParse({ type: "REVIEW_CLICK" }).success).toBe(true);
  });

  it("still rejects event types it doesn't know", () => {
    expect(recordStorefrontEventSchema.safeParse({ type: "REVIEW_SUBMITTED" }).success).toBe(false);
  });
});
