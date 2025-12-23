/**
 * Common Validation Schemas Tests
 *
 * Tests for shared Zod schemas used across the application.
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  phoneSchema,
  urlSchema,
  localeSchema,
  currencySchema,
  cuidSchema,
  decimalSchema,
  priceSchema,
  paginationSchema,
} from "../common.schemas";

describe("emailSchema", () => {
  it("should validate valid email", () => {
    const result = emailSchema.safeParse("test@example.com");
    expect(result.success).toBe(true);
  });

  it("should normalize email to lowercase", () => {
    const result = emailSchema.safeParse("TEST@EXAMPLE.COM");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("test@example.com");
    }
  });

  it("should reject empty email", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("should reject invalid email format", () => {
    const result = emailSchema.safeParse("not-an-email");
    expect(result.success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("should validate strong password", () => {
    const result = passwordSchema.safeParse("Password123");
    expect(result.success).toBe(true);
  });

  it("should reject password too short", () => {
    const result = passwordSchema.safeParse("Pass1");
    expect(result.success).toBe(false);
  });

  it("should reject password without uppercase", () => {
    const result = passwordSchema.safeParse("password123");
    expect(result.success).toBe(false);
  });

  it("should reject password without lowercase", () => {
    const result = passwordSchema.safeParse("PASSWORD123");
    expect(result.success).toBe(false);
  });

  it("should reject password without number", () => {
    const result = passwordSchema.safeParse("PasswordABC");
    expect(result.success).toBe(false);
  });
});

describe("nameSchema", () => {
  it("should validate valid name", () => {
    const result = nameSchema.safeParse("John Doe");
    expect(result.success).toBe(true);
  });

  it("should trim whitespace", () => {
    const result = nameSchema.safeParse("  John Doe  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("John Doe");
    }
  });

  it("should reject name too short", () => {
    const result = nameSchema.safeParse("J");
    expect(result.success).toBe(false);
  });

  it("should reject name too long", () => {
    const result = nameSchema.safeParse("A".repeat(101));
    expect(result.success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("should validate international phone number", () => {
    const result = phoneSchema.safeParse("+1234567890");
    expect(result.success).toBe(true);
  });

  it("should allow empty string", () => {
    const result = phoneSchema.safeParse("");
    expect(result.success).toBe(true);
  });

  it("should allow undefined", () => {
    const result = phoneSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("should reject invalid phone format", () => {
    const result = phoneSchema.safeParse("not-a-phone");
    expect(result.success).toBe(false);
  });
});

describe("urlSchema", () => {
  it("should validate valid URL", () => {
    const result = urlSchema.safeParse("https://example.com");
    expect(result.success).toBe(true);
  });

  it("should allow empty string", () => {
    const result = urlSchema.safeParse("");
    expect(result.success).toBe(true);
  });

  it("should reject invalid URL", () => {
    const result = urlSchema.safeParse("not-a-url");
    expect(result.success).toBe(false);
  });
});

describe("localeSchema", () => {
  it("should validate 'en' locale", () => {
    const result = localeSchema.safeParse("en");
    expect(result.success).toBe(true);
  });

  it("should validate 'fr' locale", () => {
    const result = localeSchema.safeParse("fr");
    expect(result.success).toBe(true);
  });

  it("should validate 'id' locale", () => {
    const result = localeSchema.safeParse("id");
    expect(result.success).toBe(true);
  });

  it("should reject unsupported locale", () => {
    const result = localeSchema.safeParse("de");
    expect(result.success).toBe(false);
  });
});

describe("currencySchema", () => {
  it("should validate valid currency code", () => {
    const result = currencySchema.safeParse("USD");
    expect(result.success).toBe(true);
  });

  it("should reject lowercase currency", () => {
    const result = currencySchema.safeParse("usd");
    expect(result.success).toBe(false);
  });

  it("should reject wrong length", () => {
    const result = currencySchema.safeParse("US");
    expect(result.success).toBe(false);
  });
});

describe("cuidSchema", () => {
  it("should validate valid CUID", () => {
    // c + 24 lowercase alphanumeric = 25 total characters
    const result = cuidSchema.safeParse("clz1234567890abcdefghijkl");
    expect(result.success).toBe(true);
  });

  it("should reject invalid CUID format", () => {
    const result = cuidSchema.safeParse("invalid-id");
    expect(result.success).toBe(false);
  });
});

describe("decimalSchema", () => {
  it("should validate positive number", () => {
    const result = decimalSchema.safeParse(10.5);
    expect(result.success).toBe(true);
  });

  it("should validate zero", () => {
    const result = decimalSchema.safeParse(0);
    expect(result.success).toBe(true);
  });

  it("should reject negative number", () => {
    const result = decimalSchema.safeParse(-1);
    expect(result.success).toBe(false);
  });

  it("should reject Infinity", () => {
    const result = decimalSchema.safeParse(Infinity);
    expect(result.success).toBe(false);
  });
});

describe("priceSchema", () => {
  it("should validate valid price", () => {
    const result = priceSchema.safeParse(19.99);
    expect(result.success).toBe(true);
  });

  it("should reject more than 2 decimal places", () => {
    const result = priceSchema.safeParse(19.999);
    expect(result.success).toBe(false);
  });

  it("should reject negative price", () => {
    const result = priceSchema.safeParse(-10);
    expect(result.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("should validate valid pagination", () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 20 });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("should reject page less than 1", () => {
    const result = paginationSchema.safeParse({ page: 0, limit: 20 });
    expect(result.success).toBe(false);
  });

  it("should reject limit over 100", () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 101 });
    expect(result.success).toBe(false);
  });
});
