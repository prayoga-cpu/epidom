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
import { getSession, getSessionResult } from "@/lib/auth";

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
      const key = secureName ? "__Secure-better-auth.session_token" : "better-auth.session_token";
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

// A dropped pooled connection used to come back to the caller as a bare
// `null`, which every API route turned into 401 "Unauthorized" — a cashier
// mid-checkout was told they were signed out over a blip they could have just
// retried through. These pin the two failure modes apart.
describe("getSessionResult", () => {
  function transientError(message: string, code?: string) {
    const err = new Error(message) as Error & { code?: string };
    if (code) err.code = code;
    return err;
  }

  it("reports a resolved session as available", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(BASE_SESSION as never);

    const result = await getSessionResult();

    expect(result.unavailable).toBe(false);
    expect(result.session?.user.id).toBe("user-1");
  });

  it("reports a missing cookie as signed out, not unavailable", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(() => undefined) } as never);

    const result = await getSessionResult();

    expect(result.session).toBeNull();
    expect(result.unavailable).toBe(false);
  });

  it("reports an expired session as signed out, not unavailable", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("expired-token") as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      ...BASE_SESSION,
      token: "expired-token",
      expiresAt: PAST,
    } as never);

    const result = await getSessionResult();

    expect(result.session).toBeNull();
    expect(result.unavailable).toBe(false);
  });

  it("retries a dropped connection and succeeds on a later attempt", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique)
      .mockRejectedValueOnce(transientError("Connection terminated unexpectedly"))
      .mockResolvedValueOnce(BASE_SESSION as never);

    const result = await getSessionResult();

    expect(prisma.session.findUnique).toHaveBeenCalledTimes(2);
    expect(result.unavailable).toBe(false);
    expect(result.session?.user.id).toBe("user-1");
  });

  it("reports unavailable when every retry hits a transient error", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockRejectedValue(
      transientError("Timed out fetching a new connection from the connection pool", "P2024")
    );

    const result = await getSessionResult();

    expect(prisma.session.findUnique).toHaveBeenCalledTimes(3);
    expect(result.session).toBeNull();
    expect(result.unavailable).toBe(true);
  });

  it("does not retry a non-transient database error, but still reports unavailable", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockRejectedValue(new Error("column does not exist"));

    const result = await getSessionResult();

    expect(prisma.session.findUnique).toHaveBeenCalledTimes(1);
    expect(result.session).toBeNull();
    expect(result.unavailable).toBe(true);
  });

  it("keeps getSession's null contract for an unavailable database", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore("valid-token") as never);
    vi.mocked(prisma.session.findUnique).mockRejectedValue(
      transientError("Can't reach database server", "P1001")
    );

    expect(await getSession()).toBeNull();
  });
});
