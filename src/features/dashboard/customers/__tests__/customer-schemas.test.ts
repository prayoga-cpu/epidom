import { describe, expect, it } from "vitest";
import {
  createAdjustPointsSchema,
  createCustomerFormSchema,
  customerToFormValues,
  defaultPhoneCountry,
  emptyCustomerForm,
  toCreateBody,
  toSignedPoints,
  toUpdateBody,
} from "../lib/customer-schemas";

// Echoing keys keeps the assertions about WHICH message fired, not its wording.
const t = (key: string) => key;

describe("createCustomerFormSchema", () => {
  const schema = createCustomerFormSchema(t);
  const valid = { name: "Marie", phone: "+33612345678", email: "m@example.com", notes: "" };

  it("accepts a fully valid customer and trims the text fields", () => {
    const parsed = schema.parse({ ...valid, name: "  Marie  ", notes: "  vegan  " });
    expect(parsed.name).toBe("Marie");
    expect(parsed.notes).toBe("vegan");
  });

  it("requires a name", () => {
    const result = schema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("customers.form.errors.nameRequired");
    }
  });

  it("treats phone and email as optional", () => {
    expect(
      schema.safeParse({ name: "Marie", phone: undefined, email: "", notes: "" }).success
    ).toBe(true);
  });

  it("rejects a truncated phone (PhoneInput reports half-typed numbers as-is)", () => {
    const result = schema.safeParse({ ...valid, phone: "+336" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("customers.form.errors.phoneInvalid");
    }
  });

  it("rejects a malformed email but lets an empty one through", () => {
    expect(schema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, email: "" }).success).toBe(true);
  });

  it("enforces the server's length limits", () => {
    expect(schema.safeParse({ ...valid, name: "a".repeat(101) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, notes: "a".repeat(501) }).success).toBe(false);
  });
});

describe("customer form <-> API body mapping", () => {
  it("create: omits every untouched optional field instead of sending empty strings", () => {
    expect(toCreateBody({ name: "Marie", phone: undefined, email: "", notes: "" })).toEqual({
      name: "Marie",
    });
    expect(
      toCreateBody({ name: "Marie", phone: "+33612345678", email: "m@example.com", notes: "vegan" })
    ).toEqual({ name: "Marie", phone: "+33612345678", email: "m@example.com", notes: "vegan" });
  });

  it("edit: an emptied field is sent as null, because that is how PATCH clears it", () => {
    expect(toUpdateBody({ name: "Marie", phone: undefined, email: "", notes: "" })).toEqual({
      name: "Marie",
      phone: null,
      email: null,
      notes: null,
    });
  });

  it("seeds the form from a stored customer, mapping null to the form's empty values", () => {
    expect(customerToFormValues({ name: "Marie", phone: null, email: null, notes: null })).toEqual({
      ...emptyCustomerForm(),
      name: "Marie",
    });
    expect(
      customerToFormValues({
        name: "Marie",
        phone: "+33612345678",
        email: "m@example.com",
        notes: "vegan",
      })
    ).toEqual({ name: "Marie", phone: "+33612345678", email: "m@example.com", notes: "vegan" });
  });
});

describe("defaultPhoneCountry", () => {
  it("follows the store currency and falls back to France, the primary market", () => {
    expect(defaultPhoneCountry("IDR")).toBe("ID");
    expect(defaultPhoneCountry("eur")).toBe("FR");
    expect(defaultPhoneCountry("XYZ")).toBe("FR");
    expect(defaultPhoneCountry(undefined)).toBe("FR");
  });
});

describe("createAdjustPointsSchema", () => {
  const schema = createAdjustPointsSchema(t, "1,000,000");
  const valid = { direction: "add" as const, points: "50", note: "Goodwill" };

  it("accepts a positive whole number with a reason", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(["", "0", "-5", "1.5", "abc", "1e3"])("rejects %j as an amount", (points) => {
    const result = schema.safeParse({ ...valid, points });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("customers.adjust.errors.amountInvalid");
    }
  });

  it("caps a single adjustment at the server's typo guard", () => {
    expect(schema.safeParse({ ...valid, points: "1000000" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, points: "1000001" }).success).toBe(false);
  });

  it("requires a reason, and keeps it within 200 characters", () => {
    expect(schema.safeParse({ ...valid, note: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, note: "a".repeat(201) }).success).toBe(false);
  });

  it("turns direction + magnitude into the signed number the API takes", () => {
    expect(toSignedPoints("add", "50")).toBe(50);
    expect(toSignedPoints("remove", "50")).toBe(-50);
  });
});
