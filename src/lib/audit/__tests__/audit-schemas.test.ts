import { describe, it, expect } from "vitest";
import {
  activityQuerySchema,
  revertSchema,
  toDateRange,
} from "@/lib/validation/audit.schemas";

describe("audit query schemas", () => {
  describe("toDateRange", () => {
    // The bug this exists to avoid: every other date filter in this codebase
    // appends T00:00:00Z and compares with `lte`, so a single-day filter
    // matches only events at exactly midnight and silently returns almost
    // nothing.
    it("makes a single-day filter cover the whole day", () => {
      const r = toDateRange("2026-09-03", "2026-09-03");
      expect(r.gte?.toISOString()).toBe("2026-09-03T00:00:00.000Z");
      expect(r.lt?.toISOString()).toBe("2026-09-04T00:00:00.000Z");
    });

    it("treats the upper bound as exclusive of the next day", () => {
      const r = toDateRange("2026-01-01", "2026-01-31");
      expect(r.lt?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });

    it("handles an open-ended range", () => {
      expect(toDateRange("2026-09-01", undefined).lt).toBeUndefined();
      expect(toDateRange(undefined, "2026-09-01").gte).toBeUndefined();
      expect(toDateRange()).toEqual({});
    });

    it("rolls over a month boundary correctly", () => {
      expect(toDateRange(undefined, "2026-02-28").lt?.toISOString()).toBe(
        "2026-03-01T00:00:00.000Z"
      );
    });
  });

  describe("activityQuerySchema", () => {
    it("rejects a datetime where a date is expected", () => {
      // Accepting this is what silently produces garbage elsewhere.
      const r = activityQuerySchema.safeParse({ from: "2026-09-03T10:00:00Z" });
      expect(r.success).toBe(false);
    });

    it("accepts a bare date", () => {
      expect(activityQuerySchema.safeParse({ from: "2026-09-03" }).success).toBe(true);
    });

    it("defaults to newest-first with a bounded page size", () => {
      const r = activityQuerySchema.parse({});
      expect(r.sortBy).toBe("occurredAt");
      expect(r.sortDir).toBe("desc");
      expect(r.limit).toBe(50);
    });

    it("caps the page size so one request cannot pull the whole table", () => {
      expect(activityQuerySchema.safeParse({ limit: 5000 }).success).toBe(false);
      expect(activityQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    });
  });

  describe("revertSchema", () => {
    it("requires a substantive reason", () => {
      expect(revertSchema.safeParse({ actionLogId: "a", reason: "oops", confirmed: true }).success).toBe(
        false
      );
      expect(
        revertSchema.safeParse({
          actionLogId: "a",
          reason: "Reverting an accidental plan downgrade reported by the customer.",
          confirmed: true,
        }).success
      ).toBe(true);
    });

    it("refuses an unconfirmed revert", () => {
      expect(
        revertSchema.safeParse({
          actionLogId: "a",
          reason: "A perfectly adequate reason for reverting.",
          confirmed: false,
        }).success
      ).toBe(false);
    });
  });
});
