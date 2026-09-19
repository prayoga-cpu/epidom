import { describe, it, expect } from "vitest";
import {
  adjustPointsSchema,
  createCustomerSchema,
  customerListQuerySchema,
  MAX_POINTS_ADJUSTMENT,
  updateCustomerSchema,
} from "../customers.schemas";

describe("createCustomerSchema", () => {
  it("accepts a name alone (a walk-in with just a name is a valid customer)", () => {
    expect(createCustomerSchema.parse({ name: "  Ana  " })).toEqual({ name: "Ana" });
  });

  it("treats empty optional inputs as absent instead of failing their format check", () => {
    const parsed = createCustomerSchema.parse({ name: "Ana", phone: "", email: "", notes: "" });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.email).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it("lowercases and validates the e-mail", () => {
    expect(createCustomerSchema.parse({ name: "A", email: "Ana@Example.COM" }).email).toBe(
      "ana@example.com"
    );
    const bad = createCustomerSchema.safeParse({ name: "A", email: "not-an-email" });
    expect(bad.success).toBe(false);
    // A specific message, not the generic "Invalid input" a union would give.
    if (!bad.success)
      expect(bad.error.issues[0]).toMatchObject({
        path: ["email"],
        message: "Invalid email format",
      });
  });

  it("requires a non-blank name and bounds every field", () => {
    expect(createCustomerSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "A", phone: "1".repeat(31) }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ name: "A", notes: "n".repeat(501) }).success).toBe(
      false
    );
  });
});

describe("updateCustomerSchema", () => {
  it("null and empty string CLEAR phone / email / notes; a missing key leaves them alone", () => {
    const parsed = updateCustomerSchema.parse({ phone: "", email: null, notes: "" });
    expect(parsed).toEqual({ phone: null, email: null, notes: null });
    expect("name" in updateCustomerSchema.parse({ phone: "+33612345678" })).toBe(false);
  });

  it("lowercases a new e-mail and reports a bad one specifically", () => {
    expect(updateCustomerSchema.parse({ email: "Ana@Example.COM" }).email).toBe("ana@example.com");
    const bad = updateCustomerSchema.safeParse({ email: "nope" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toBe("Invalid email format");
  });

  it("refuses an empty patch", () => {
    expect(updateCustomerSchema.safeParse({}).success).toBe(false);
  });

  it("still rejects a blank name", () => {
    expect(updateCustomerSchema.safeParse({ name: " " }).success).toBe(false);
  });
});

describe("adjustPointsSchema", () => {
  it("accepts a signed whole number with a reason", () => {
    expect(adjustPointsSchema.parse({ points: 50, note: " goodwill " })).toEqual({
      points: 50,
      note: "goodwill",
    });
    expect(adjustPointsSchema.parse({ points: -20, note: "correction" }).points).toBe(-20);
  });

  it("rejects zero, fractions, absurd sizes and a missing reason", () => {
    expect(adjustPointsSchema.safeParse({ points: 0, note: "x" }).success).toBe(false);
    expect(adjustPointsSchema.safeParse({ points: 1.5, note: "x" }).success).toBe(false);
    expect(
      adjustPointsSchema.safeParse({ points: MAX_POINTS_ADJUSTMENT + 1, note: "x" }).success
    ).toBe(false);
    expect(
      adjustPointsSchema.safeParse({ points: -(MAX_POINTS_ADJUSTMENT + 1), note: "x" }).success
    ).toBe(false);
    expect(adjustPointsSchema.safeParse({ points: 10, note: "   " }).success).toBe(false);
    expect(adjustPointsSchema.safeParse({ points: 10 }).success).toBe(false);
  });
});

describe("customerListQuerySchema", () => {
  it("has sane defaults", () => {
    expect(customerListQuerySchema.parse({})).toEqual({
      limit: 25,
      sort: "name",
      includeSummary: false,
    });
  });

  it("coerces the query-string forms", () => {
    const q = customerListQuerySchema.parse({
      limit: "8",
      includeSummary: "1",
      q: " ana ",
      sort: "points",
    });
    expect(q).toMatchObject({ limit: 8, includeSummary: true, q: "ana", sort: "points" });
    expect(customerListQuerySchema.parse({ includeSummary: "0" }).includeSummary).toBe(false);
  });

  it("caps the page size and refuses a sort that would need a full aggregation", () => {
    expect(customerListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(customerListQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(customerListQuerySchema.safeParse({ sort: "lifetimeSpend" }).success).toBe(false);
  });
});
