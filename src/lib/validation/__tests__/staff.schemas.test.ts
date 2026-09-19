import { describe, it, expect } from "vitest";
import { updateStaffSchema } from "../operations.schemas";

describe("updateStaffSchema — Contract card (payType / payRate / contractType)", () => {
  it("accepts every contract type, and null to clear it", () => {
    for (const contractType of ["FREELANCE", "PART_TIME", "FULL_TIME", "CONTRACT", null]) {
      expect(updateStaffSchema.safeParse({ contractType }).success).toBe(true);
    }
  });

  it("rejects an unknown contract type", () => {
    expect(updateStaffSchema.safeParse({ contractType: "INTERN" }).success).toBe(false);
  });

  it("accepts the SALES pay type", () => {
    expect(updateStaffSchema.safeParse({ payType: "SALES", payRate: 5 }).success).toBe(true);
  });

  it("caps a SALES commission at 100% — the input's HTML max doesn't stop a click-to-save", () => {
    const over = updateStaffSchema.safeParse({ payType: "SALES", payRate: 101 });
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(over.error.issues[0].path).toEqual(["payRate"]);
    }
    expect(updateStaffSchema.safeParse({ payType: "SALES", payRate: 100 }).success).toBe(true);
  });

  it("does NOT cap HOURLY/MONTHLY rates at 100 — those are currency amounts, not percentages", () => {
    expect(updateStaffSchema.safeParse({ payType: "HOURLY", payRate: 25000 }).success).toBe(true);
    expect(updateStaffSchema.safeParse({ payType: "MONTHLY", payRate: 4500000 }).success).toBe(true);
  });

  it("still rejects a negative rate for every pay type", () => {
    expect(updateStaffSchema.safeParse({ payType: "SALES", payRate: -1 }).success).toBe(false);
    expect(updateStaffSchema.safeParse({ payType: "HOURLY", payRate: -1 }).success).toBe(false);
  });
});
