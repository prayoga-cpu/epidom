import { describe, it, expect } from "vitest";
import { matchesMenuDepartment } from "../menu-department";

describe("matchesMenuDepartment — the POS Food / Drink tabs", () => {
  it("All lists everything", () => {
    for (const d of ["KITCHEN", "BAR", "BOTH", "CUSTOM", null, undefined] as const)
      expect(matchesMenuDepartment(d, null)).toBe(true);
  });

  it("Food is the Kitchen department and Drink the Bar one", () => {
    expect(matchesMenuDepartment("KITCHEN", "KITCHEN")).toBe(true);
    expect(matchesMenuDepartment("BAR", "KITCHEN")).toBe(false);
    expect(matchesMenuDepartment("BAR", "BAR")).toBe(true);
    expect(matchesMenuDepartment("KITCHEN", "BAR")).toBe(false);
  });

  it("an item made in both is under Food and under Drink, never the custom line", () => {
    expect(matchesMenuDepartment("BOTH", "KITCHEN")).toBe(true);
    expect(matchesMenuDepartment("BOTH", "BAR")).toBe(true);
    expect(matchesMenuDepartment("BOTH", "CUSTOM")).toBe(false);
  });

  it("the custom line holds only its own items", () => {
    expect(matchesMenuDepartment("CUSTOM", "CUSTOM")).toBe(true);
    expect(matchesMenuDepartment("CUSTOM", "KITCHEN")).toBe(false);
    expect(matchesMenuDepartment("KITCHEN", "CUSTOM")).toBe(false);
  });
});
