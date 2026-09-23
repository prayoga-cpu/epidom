import { describe, it, expect, afterEach, vi } from "vitest";
import {
  STAFF_INVITE_TTL_MS,
  buildStaffInviteUrl,
  emailsMatch,
  generateStaffInviteToken,
  maskEmail,
  staffInviteState,
} from "../staff-invite";

afterEach(() => vi.unstubAllEnvs());

describe("generateStaffInviteToken", () => {
  it("is 256 bits of URL-safe randomness, different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateStaffInviteToken));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("buildStaffInviteUrl", () => {
  it("puts the token in the QUERY string — never the path, which the audit trail records", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.epidom.com");
    expect(buildStaffInviteUrl("abc_DEF-123")).toBe("https://app.epidom.com/staff-invite?token=abc_DEF-123");
  });

  it("tolerates a trailing slash on the base URL, and falls back to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.epidom.com/");
    expect(buildStaffInviteUrl("t")).toBe("https://app.epidom.com/staff-invite?token=t");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(buildStaffInviteUrl("t")).toBe("http://localhost:3000/staff-invite?token=t");
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the domain only", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***@example.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("never reveals anything for a malformed address", () => {
    expect(maskEmail("no-at-sign")).toBe("***");
    expect(maskEmail("@nolocal.com")).toBe("***");
    expect(maskEmail("")).toBe("***");
  });

  it("uses the LAST @ so an odd local part can't shift what's shown", () => {
    expect(maskEmail("weird@name@example.com")).toBe("w***@example.com");
  });
});

describe("emailsMatch", () => {
  it("ignores case and surrounding whitespace — email addresses aren't case-sensitive", () => {
    expect(emailsMatch("Jane.Doe@Example.COM", " jane.doe@example.com ")).toBe(true);
  });

  it("does not treat different addresses as the same", () => {
    expect(emailsMatch("jane@example.com", "jane@example.org")).toBe(false);
    expect(emailsMatch("jane@example.com", "jane+x@example.com")).toBe(false);
    expect(emailsMatch("", "a@b.c")).toBe(false);
  });
});

describe("staffInviteState", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const future = new Date(now.getTime() + 1000);
  const past = new Date(now.getTime() - 1000);

  it("classifies every state, in priority order", () => {
    expect(staffInviteState(null, now)).toBe("not_found");
    expect(staffInviteState({ expiresAt: future, consumedAt: null }, now)).toBe("valid");
    expect(staffInviteState({ expiresAt: past, consumedAt: null }, now)).toBe("expired");
    expect(staffInviteState({ expiresAt: future, consumedAt: past }, now)).toBe("consumed");
    // Used AND expired: it was used — that's the more useful thing to tell someone.
    expect(staffInviteState({ expiresAt: past, consumedAt: past }, now)).toBe("consumed");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(staffInviteState({ expiresAt: now, consumedAt: null }, now)).toBe("expired");
  });
});

describe("STAFF_INVITE_TTL_MS", () => {
  it("is seven days", () => {
    expect(STAFF_INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
