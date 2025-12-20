/**
 * Auth Validation Schemas Tests
 *
 * Tests for authentication-related Zod schemas.
 */

import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../auth.schemas";

describe("registerSchema", () => {
  it("should validate valid registration data", () => {
    const validData = {
      email: "test@example.com",
      password: "Password123",
      name: "John Doe",
    };

    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should validate with optional business name", () => {
    const validData = {
      email: "test@example.com",
      password: "Password123",
      name: "John Doe",
      businessName: "My Bakery",
    };

    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email format", () => {
    const invalidData = {
      email: "not-an-email",
      password: "Password123",
      name: "John Doe",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain("email");
    }
  });

  it("should reject password without uppercase", () => {
    const invalidData = {
      email: "test@example.com",
      password: "password123",
      name: "John Doe",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject password without number", () => {
    const invalidData = {
      email: "test@example.com",
      password: "PasswordABC",
      name: "John Doe",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject password too short", () => {
    const invalidData = {
      email: "test@example.com",
      password: "Pass1",
      name: "John Doe",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject name too short", () => {
    const invalidData = {
      email: "test@example.com",
      password: "Password123",
      name: "J",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("should validate valid login data", () => {
    const validData = {
      email: "test@example.com",
      password: "anypassword",
    };

    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject empty password", () => {
    const invalidData = {
      email: "test@example.com",
      password: "",
    };

    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("should validate valid profile update", () => {
    const validData = {
      name: "Jane Doe",
      phone: "+1234567890",
      locale: "en",
    };

    const result = updateProfileSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should allow empty phone (to clear)", () => {
    const validData = {
      phone: "",
    };

    const result = updateProfileSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid phone format", () => {
    const invalidData = {
      phone: "not-a-phone",
    };

    const result = updateProfileSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("should validate valid password change", () => {
    const validData = {
      currentPassword: "OldPassword123",
      newPassword: "NewPassword456",
      confirmPassword: "NewPassword456",
    };

    const result = changePasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject mismatched passwords", () => {
    const invalidData = {
      currentPassword: "OldPassword123",
      newPassword: "NewPassword456",
      confirmPassword: "DifferentPassword789",
    };

    const result = changePasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("should reject same old and new password", () => {
    const invalidData = {
      currentPassword: "Password123",
      newPassword: "Password123",
      confirmPassword: "Password123",
    };

    const result = changePasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
