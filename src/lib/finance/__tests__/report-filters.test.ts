import { describe, it, expect } from "vitest";
import {
  shiftFilter,
  categoryFilter,
  departmentFilter,
  channelFilter,
  paymentMethodFilter,
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
    expect(
      shiftFilter(new URLSearchParams({ shiftId: "shift-1", staffId: "staff-1" }))
    ).toEqual({ shiftId: "shift-1" });
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

  it("matches a specific department", () => {
    expect(departmentFilter("KITCHEN")).toEqual({ menuItem: { department: "KITCHEN" } });
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

  it("matches a specific payment method", () => {
    expect(paymentMethodFilter("QRIS")).toEqual({ paymentMethod: "QRIS" });
  });
});
