import { describe, it, expect } from "vitest";
import { bucketWasteByReason } from "@/lib/finance/report-aggregation";

describe("bucketWasteByReason", () => {
  it("groups entries under their predefined reason, value summed", () => {
    const result = bucketWasteByReason([
      { reason: "EXPIRED", customReason: null, quantity: 2, totalValue: 5 },
      { reason: "EXPIRED", customReason: null, quantity: 1, totalValue: 3 },
      { reason: "DAMAGED", customReason: null, quantity: 1, totalValue: 10 },
    ]);

    const expired = result.find((r) => r.reason === "EXPIRED");
    const damaged = result.find((r) => r.reason === "DAMAGED");
    expect(expired).toMatchObject({ label: "EXPIRED", entryCount: 2, totalQuantity: 3, totalValue: 8 });
    expect(damaged).toMatchObject({ label: "DAMAGED", entryCount: 1, totalQuantity: 1, totalValue: 10 });
  });

  it("keeps distinct OTHER customReasons in separate buckets rather than merging them", () => {
    const result = bucketWasteByReason([
      { reason: "OTHER", customReason: "Power outage", quantity: 1, totalValue: 4 },
      { reason: "OTHER", customReason: "Fridge failure", quantity: 1, totalValue: 6 },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.label).sort()).toEqual(["Fridge failure", "Power outage"]);
  });

  it("falls back to the literal 'Other' label when customReason is blank", () => {
    const result = bucketWasteByReason([
      { reason: "OTHER", customReason: null, quantity: 1, totalValue: 1 },
    ]);
    expect(result[0].label).toBe("Other");
  });

  it("sorts buckets by totalValue descending", () => {
    const result = bucketWasteByReason([
      { reason: "SPOILED", customReason: null, quantity: 1, totalValue: 10 },
      { reason: "DAMAGED", customReason: null, quantity: 1, totalValue: 90 },
    ]);
    expect(result.map((r) => r.reason)).toEqual(["DAMAGED", "SPOILED"]);
  });

  it("rounds totalValue to 2 decimal places", () => {
    const result = bucketWasteByReason([
      { reason: "EXPIRED", customReason: null, quantity: 1, totalValue: 3.333 },
      { reason: "EXPIRED", customReason: null, quantity: 1, totalValue: 3.333 },
    ]);
    expect(result[0].totalValue).toBe(6.67);
  });
});
