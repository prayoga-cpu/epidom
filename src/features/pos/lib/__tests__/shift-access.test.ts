import { describe, it, expect } from "vitest";
import { canManageShift } from "../shift-access";

describe("canManageShift", () => {
  it("cashiers and managers with the POS page can hold a till", () => {
    expect(canManageShift({ staffRole: "CASHIER", allowedPages: ["/pos", "/pos/orders"] })).toBe(
      true
    );
    expect(canManageShift({ staffRole: "MANAGER", allowedPages: ["/pos"] })).toBe(true);
  });

  it("kitchen never counts cash", () => {
    expect(canManageShift({ staffRole: "KITCHEN", allowedPages: ["/pos", "/pos/kds"] })).toBe(
      false
    );
  });

  it("follows the same /pos grant the till APIs require — a floor-only persona has no till", () => {
    expect(
      canManageShift({ staffRole: "CASHIER", allowedPages: ["/tables", "/pos/schedule"] })
    ).toBe(false);
  });

  it("the owner persona (unrestricted) can", () => {
    expect(canManageShift({ staffRole: "OWNER", allowedPages: null })).toBe(true);
  });

  it("no persona, no till", () => {
    expect(canManageShift({ staffRole: null, allowedPages: null })).toBe(false);
  });

  it("a session that never carried a page list is unrestricted, not an error", () => {
    expect(
      canManageShift({ staffRole: "CASHIER", allowedPages: undefined as unknown as null })
    ).toBe(true);
  });
});
