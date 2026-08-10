import { describe, it, expect } from "vitest";
import { hashVisitor } from "../visitor-hash";

describe("hashVisitor", () => {
  it("is deterministic for the same ip/userAgent/salt on the same day", () => {
    const a = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    const b = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    expect(a).toBe(b);
  });

  it("differs when the IP differs", () => {
    const a = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    const b = hashVisitor("203.0.113.9", "Mozilla/5.0", "store-a");
    expect(a).not.toBe(b);
  });

  it("differs when the salt (store/slug) differs", () => {
    const a = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    const b = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-b");
    expect(a).not.toBe(b);
  });

  it("never contains the raw IP in its output", () => {
    const hash = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    expect(hash).not.toContain("203.0.113.5");
  });

  it("returns a fixed-length hex string", () => {
    const hash = hashVisitor("203.0.113.5", "Mozilla/5.0", "store-a");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
