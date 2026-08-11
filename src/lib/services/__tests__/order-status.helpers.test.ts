import { describe, it, expect } from "vitest";
import { resolveInitialOrderItemStatus } from "../order-status.helpers";

describe("resolveInitialOrderItemStatus", () => {
  it("returns SERVED for a CUSTOM-productLine item — no kitchen/bar prep step", () => {
    expect(resolveInitialOrderItemStatus("CUSTOM")).toBe("SERVED");
  });

  it("returns PENDING for a STANDARD-productLine item", () => {
    expect(resolveInitialOrderItemStatus("STANDARD")).toBe("PENDING");
  });

  it("returns PENDING when productLine is null/undefined (unresolvable product)", () => {
    expect(resolveInitialOrderItemStatus(null)).toBe("PENDING");
    expect(resolveInitialOrderItemStatus(undefined)).toBe("PENDING");
  });
});
