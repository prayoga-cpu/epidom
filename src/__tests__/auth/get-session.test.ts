import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted — no external variables allowed in factories.

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findUnique: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/lib/services/email.service", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ isAdminEmail: vi.fn(() => false) }));
vi.mock("better-auth", () => ({ betterAuth: vi.fn(() => ({})) }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: vi.fn() }));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-for-auth-unit-tests";
const FUTURE = new Date(Date.now() + 1000 * 60 * 60);
const PAST = new Date(Date.now() - 1000);

const BASE_SESSION = {
  id: "sess-1",
  userId: "user-1",
  token: "valid-token",
  expiresAt: FUTURE,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  ipAddress: null,
  userAgent: null,
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

function makeCookieStore(tokenValue?: string, secureName = false) {
  return {
    get: vi.fn((name: string) => {
      const key = secureName
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token";
      return name === key ? { value: tokenValue } : undefined;
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.BETTER_AUTH_SECRET = SECRET;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getSession", () => {
  it("returns null when no session cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(() => undefined) } as never);
    expect(await getSession()).toBeNull();
  });

  it("returns null when BETTER_AUTH_SECRET is not set", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("some.token") as never);
    expect(await getSession()).toBeNull();
  });

  it("returns null when session is not found in DB", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("bad-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it("returns null when session is expired", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("expired-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      ...BASE_SESSION,
      token: "expired-token",
      expiresAt: PAST,
    } as never);
    expect(await getSession()).toBeNull();
  });

  it("returns session and user when token is valid and session is active", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(BASE_SESSION as never);

    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-1");
    expect(result?.user.email).toBe("test@example.com");
    expect(result?.session.userId).toBe("user-1");
  });

  it("reads from __Secure- cookie name when standard cookie is absent", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("secure-token", true) as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      ...BASE_SESSION,
      token: "secure-token",
    } as never);

    const result = await getSession();
    expect(result?.session.id).toBe("sess-1");
  });

  it("does not expose the raw token in the returned session object", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(BASE_SESSION as never);

    const result = await getSession();
    expect(result?.session).not.toHaveProperty("token");
  });

  it("returns null and does not throw when cookies() throws", async () => {
    vi.mocked(cookies).mockRejectedValue(new Error("headers unavailable") as never);
    expect(await getSession()).toBeNull();
  });
});
