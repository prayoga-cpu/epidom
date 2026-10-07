import { describe, it, expect } from "vitest";
import {
  shiftFilter,
  categoryFilter,
  departmentFilter,
  channelFilter,
  paymentMethodFilter,
  parseReportBound,
  reportDayRange,
  UNCATEGORIZED,
} from "../report-filters";

describe("shiftFilter", () => {
  it("returns {} when neither shiftId nor staffId is present", () => {
    expect(shiftFilter(new URLSearchParams())).toEqual({});
  });

  it("filters by shiftId when present", () => {
    expect(shiftFilter(new URLSearchParams({ shiftId: "shift-1" }))).toEqual({
      shiftId: "shift-1",
    });
  });

  it("shiftId takes precedence over staffId when both are present", () => {
    expect(shiftFilter(new URLSearchParams({ shiftId: "shift-1", staffId: "staff-1" }))).toEqual({
      shiftId: "shift-1",
    });
  });

  it("filters by staffId (via shift relation) when shiftId is absent", () => {
    expect(shiftFilter(new URLSearchParams({ staffId: "staff-1" }))).toEqual({
      shift: { staffMemberId: "staff-1" },
    });
  });
});

describe("categoryFilter", () => {
  it("returns {} for null", () => {
    expect(categoryFilter(null)).toEqual({});
  });

  it("matches items with no menuItem or no category for the uncategorized sentinel", () => {
    expect(categoryFilter(UNCATEGORIZED)).toEqual({
      OR: [{ menuItemId: null }, { menuItem: { categoryId: null } }],
    });
  });

  it("matches a specific category id", () => {
    expect(categoryFilter("cat-1")).toEqual({ menuItem: { categoryId: "cat-1" } });
  });
});

describe("departmentFilter", () => {
  it("returns {} for null", () => {
    expect(departmentFilter(null)).toEqual({});
  });

  it("matches items with no menuItem for the uncategorized sentinel", () => {
    expect(departmentFilter(UNCATEGORIZED)).toEqual({ menuItemId: null });
  });

  it("matches a specific department, leaving the custom product line out", () => {
    expect(departmentFilter("KITCHEN")).toEqual({
      menuItem: { department: "KITCHEN", NOT: { product: { productLine: "CUSTOM" } } },
    });
  });

  it("matches the custom product line by its product, not its stored department", () => {
    expect(departmentFilter("CUSTOM")).toEqual({
      menuItem: { product: { productLine: "CUSTOM" } },
    });
  });
});

describe("channelFilter", () => {
  it("returns {} for null", () => {
    expect(channelFilter(null)).toEqual({});
  });

  it("matches a specific source", () => {
    expect(channelFilter("GOFOOD")).toEqual({ source: "GOFOOD" });
  });
});

describe("paymentMethodFilter", () => {
  it("returns {} for null", () => {
    expect(paymentMethodFilter(null)).toEqual({});
  });

  it("matches the whole-order method OR any single tender", () => {
    // A bill settled cash + card carries paymentMethod "SPLIT", so matching
    // only the order-level column would hide it from every method filter.
    expect(paymentMethodFilter("QRIS")).toEqual({
      OR: [{ paymentMethod: "QRIS" }, { payments: { some: { method: "QRIS" } } }],
    });
  });

  it("accepts SPLIT, which selects multi-tender bills", () => {
    // No tender is ever SPLIT, so only the first branch can match — that is
    // exactly "orders paid with two or more tenders". The UI never offers it.
    expect(paymentMethodFilter("SPLIT")).toEqual({
      OR: [{ paymentMethod: "SPLIT" }, { payments: { some: { method: "SPLIT" } } }],
    });
  });
});

describe("parseReportBound", () => {
  it("widens a bare date to the start or the end of that whole day", () => {
    expect(parseReportBound("2026-10-05", "start")?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(parseReportBound("2026-10-05", "end")?.toISOString()).toBe("2026-10-05T23:59:59.000Z");
  });

  it("passes a till session's exact datetime through", () => {
    expect(parseReportBound("2026-10-05T01:30:00.000Z", "end")?.toISOString()).toBe(
      "2026-10-05T01:30:00.000Z"
    );
  });

  it("is null for a missing or garbled value", () => {
    expect(parseReportBound(null, "start")).toBeNull();
    expect(parseReportBound("2026-10-05ZT00:00:00Z", "start")).toBeNull();
  });
});

describe("reportDayRange", () => {
  it("is the UTC days the report asked for, whatever the store's time zone", () => {
    // In Jakarta 23:59:59Z on the 31st is already the 1st — the days asked
    // for are still the 1st to the 31st.
    expect(
      reportDayRange(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-31T23:59:59Z"))
    ).toEqual({ fromKey: "2026-10-01", toKey: "2026-10-31" });
  });
});
