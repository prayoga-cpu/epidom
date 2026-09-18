import { describe, it, expect } from "vitest";
import { staffAccessLabelKey } from "../staff-access-label";

describe("staffAccessLabelKey", () => {
  it("returns the combined key when a staff member has both shells granted", () => {
    expect(staffAccessLabelKey(["/pos", "/finance"])).toBe("pages.staffAccessBoth");
  });

  it("returns Back Office only when every granted page is non-POS", () => {
    expect(staffAccessLabelKey(["/finance", "/staff"])).toBe("pages.staffAccessBackOffice");
  });

  it("returns POS only when every granted page is a POS Mode route, including /tables", () => {
    expect(staffAccessLabelKey(["/pos", "/pos/orders"])).toBe("pages.staffAccessPos");
    expect(staffAccessLabelKey(["/tables"])).toBe("pages.staffAccessPos");
  });

  it("returns null when there's nothing granted at all", () => {
    expect(staffAccessLabelKey([])).toBe(null);
    expect(staffAccessLabelKey(null)).toBe(null);
    expect(staffAccessLabelKey(undefined)).toBe(null);
  });
});
