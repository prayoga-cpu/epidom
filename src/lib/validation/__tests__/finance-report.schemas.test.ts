import { describe, it, expect } from "vitest";
import { financeReportRangeSchema } from "../finance-report.schemas";

describe("financeReportRangeSchema", () => {
  it("takes the ISO dates and datetimes the Finance page sends", () => {
    expect(
      financeReportRangeSchema.safeParse({ from: "2026-10-01", to: "2026-10-06T23:59:59.999Z" })
        .success
    ).toBe(true);
    expect(financeReportRangeSchema.safeParse({}).success).toBe(true);
  });

  it("refuses a date that doesn't parse, instead of failing in the database", () => {
    expect(financeReportRangeSchema.safeParse({ from: "yesterday" }).success).toBe(false);
    expect(financeReportRangeSchema.safeParse({ to: "2026-13-45" }).success).toBe(false);
  });
});
