import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decryptField, encryptField } from "../field-encryption";

const ORIGINAL = process.env.BETTER_AUTH_SECRET;
beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
});
afterEach(() => {
  process.env.BETTER_AUTH_SECRET = ORIGINAL;
});

describe("field encryption", () => {
  it("round-trips, and never stores the plain text", () => {
    const stored = encryptField('{"accountNumber":"FR7630006000011234567890189"}', "bank:v1");
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("FR76");
    expect(decryptField(stored, "bank:v1")).toBe('{"accountNumber":"FR7630006000011234567890189"}');
  });

  it("each value gets its own IV", () => {
    expect(encryptField("same", "bank:v1")).not.toBe(encryptField("same", "bank:v1"));
  });

  it("a tampered value, another purpose or another secret reads as null", () => {
    const stored = encryptField("secret", "bank:v1");
    const parts = stored.split(".");
    parts[3] = Buffer.from("garbage").toString("base64url");
    expect(decryptField(parts.join("."), "bank:v1")).toBeNull();
    expect(decryptField(stored, "other:v1")).toBeNull();
    process.env.BETTER_AUTH_SECRET = "another-environment";
    expect(decryptField(stored, "bank:v1")).toBeNull();
  });

  it("null or malformed input reads as null", () => {
    expect(decryptField(null, "bank:v1")).toBeNull();
    expect(decryptField("plain text", "bank:v1")).toBeNull();
  });
});
