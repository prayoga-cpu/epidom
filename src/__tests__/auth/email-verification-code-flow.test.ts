// @vitest-environment node
/**
 * The real Better Auth config from src/lib/auth.ts, driven over HTTP through
 * auth.handler, with an in-memory database and the mailer captured instead of
 * sent. Covers the two ways to confirm an address that ride in one email: the
 * link and the 6-digit code.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  db: {} as Record<string, unknown[]>,
  sendVerificationEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("better-auth/adapters/prisma", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { prismaAdapter: () => memoryAdapter(h.db) };
});
vi.mock("@/lib/services/email.service", () => ({
  sendVerificationEmail: h.sendVerificationEmail,
  sendPasswordResetEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/admin", () => ({ isAdminEmail: () => false }));
vi.mock("@/lib/services/sales-page.service", () => ({ recordSalesPageSignup: vi.fn() }));
vi.mock("@/lib/services/signup-attribution.service", () => ({
  recordSignupAttribution: vi.fn(),
  requestIp: () => null,
}));

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

let auth: typeof import("@/lib/auth").auth;

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET ||= "test-secret-for-the-email-code-flow-0123456789";
  ({ auth } = await import("@/lib/auth"));
});

beforeEach(() => {
  for (const table of ["user", "session", "account", "verification"]) h.db[table] = [];
  h.sendVerificationEmail.mockReset();
  h.sendVerificationEmail.mockResolvedValue({ success: true, messageId: "msg_1" });
});

function post(path: string, body: unknown) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    })
  );
}

/** Signs up and returns what the verification email was given: [email, name, url, code]. */
async function signUp(email: string) {
  const res = await post("/sign-up/email", { email, password: PASSWORD, name: "Thirst traps " });
  expect(res.status).toBe(200);
  expect(h.sendVerificationEmail).toHaveBeenCalledTimes(1);
  return h.sendVerificationEmail.mock.calls[0] as [string, string, string, string | null];
}

function userRow(email: string) {
  return (h.db.user as { email: string; emailVerified: boolean }[]).find((u) => u.email === email);
}

describe("verification email: link and 6-digit code", () => {
  it("puts a 6-digit code next to the link, and only a hash of it is stored", async () => {
    const [to, , url, code] = await signUp("dendi@example.com");

    expect(to).toBe("dendi@example.com");
    expect(url).toContain("/api/auth/verify-email?token=");
    expect(code).toMatch(/^\d{6}$/);
    const stored = JSON.stringify(h.db.verification);
    expect(stored).toContain("email-verification-otp-dendi@example.com");
    expect(stored).not.toContain(code!);
  });

  it("verifies and signs in with the code, like the link would", async () => {
    const [email, , , code] = await signUp("dendi@example.com");

    const wrong = await post("/email-otp/verify-email", {
      email,
      otp: code === "000000" ? "111111" : "000000",
    });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).code).toBe("INVALID_OTP");
    expect(userRow(email)?.emailVerified).toBe(false);

    const right = await post("/email-otp/verify-email", { email, otp: code });
    expect(right.status).toBe(200);
    expect((await right.json()).token).toEqual(expect.any(String));
    expect(right.headers.get("set-cookie")).toContain("better-auth.session_token=");
    expect(userRow(email)?.emailVerified).toBe(true);
  });

  it("still verifies with the link from the same email", async () => {
    const [email, , url] = await signUp("dendi@example.com");

    const res = await auth.handler(new Request(url, { headers: { origin: ORIGIN } }));

    expect([200, 302]).toContain(res.status);
    expect(userRow(email)?.emailVerified).toBe(true);
  });

  it("a resend makes a new code, and only the newest one works", async () => {
    const [email, , , first] = await signUp("dendi@example.com");
    h.sendVerificationEmail.mockClear();

    const resend = await post("/send-verification-email", { email });
    expect(resend.status).toBe(200);
    const second = h.sendVerificationEmail.mock.calls[0][3] as string;
    expect(second).toMatch(/^\d{6}$/);

    if (first !== second) {
      const old = await post("/email-otp/verify-email", { email, otp: first });
      expect(old.status).toBe(400);
    }
    const fresh = await post("/email-otp/verify-email", { email, otp: second });
    expect(fresh.status).toBe(200);
  });

  it("sends no code (and no email) for an address that is already verified", async () => {
    const [email, , , code] = await signUp("dendi@example.com");
    await post("/email-otp/verify-email", { email, otp: code });
    h.sendVerificationEmail.mockClear();

    await post("/send-verification-email", { email });

    expect(h.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["/email-otp/send-verification-otp", { email: "dendi@example.com", type: "sign-in" }],
    ["/sign-in/email-otp", { email: "dendi@example.com", otp: "123456" }],
    ["/email-otp/request-password-reset", { email: "dendi@example.com" }],
    ["/email-otp/reset-password", { email: "dendi@example.com", otp: "123456", password: "x" }],
    [
      "/email-otp/check-verification-otp",
      { email: "dendi@example.com", type: "email-verification", otp: "123456" },
    ],
  ])("keeps %s switched off (404)", async (path, body) => {
    await signUp("dendi@example.com");

    const res = await post(path, body);

    expect(res.status).toBe(404);
  });
});
